import { homeSelection, type HomeFamilyContext } from "./familyHome";

/** Only an unfinished local write outranks the account's server preference. */
export class HomeSelectionSync {
  private revision = 0;
  private pending: { token: number; choice: string | null } | null = null;
  private serverChoice: string | null;
  private serverVersion: string | null;
  readonly actorId: string | null;
  constructor(context: HomeFamilyContext) {
    this.actorId = context.actorId;
    this.serverChoice = homeSelection(context, context.selectedChildId);
    this.serverVersion = context.preferenceVersion;
  }
  begin(choice: string | null) {
    const token = ++this.revision;
    this.pending = { token, choice };
    return token;
  }
  isPending(token: number) { return this.pending?.token === token; }
  choice(token: number) { return this.isPending(token) ? this.pending!.choice : undefined; }
  settle(token: number) { if (this.isPending(token)) this.pending = null; }
  cancel() { this.pending = null; ++this.revision; }
  reconcile(context: HomeFamilyContext) {
    if (context.actorId !== this.actorId) { this.cancel(); throw new Error("selection_actor_changed"); }
    // ACL loss wins even over an unfinished write or an older preference revision.
    if (this.pending?.choice && !context.children.some(child => child.id === this.pending!.choice)) this.cancel();
    const version = context.preferenceVersion;
    if (!this.serverVersion || (version && Date.parse(version) >= Date.parse(this.serverVersion))) {
      this.serverVersion = version;
      this.serverChoice = homeSelection(context, context.selectedChildId);
    }
    this.serverChoice = homeSelection(context, this.serverChoice);
    return this.pending ? this.pending.choice : this.serverChoice;
  }
}

type Persistence = {
  context: () => Promise<HomeFamilyContext>;
  save: (choice: string | null, version: string | null) => Promise<void>;
};
/** Shared with tests: settle CAS conflicts/failures against fresh server truth. */
export async function persistHomeSelection(sync: HomeSelectionSync, token: number, deps: Persistence) {
  if (!sync.isPending(token)) return "obsolete";
  let outcome: "saved" | "conflict" | "failed" = "saved";
  try {
    const before = await deps.context();
    sync.reconcile(before);
    if (!sync.isPending(token)) return "obsolete";
    await deps.save(sync.choice(token)!, before.preferenceVersion);
  } catch (error) {
    outcome = error instanceof Error && error.message === "home_409" ? "conflict" : "failed";
  }
  try {
    const after = await deps.context();
    sync.reconcile(after);
  } catch { outcome = "failed"; }
  if (!sync.isPending(token)) return "obsolete";
  sync.settle(token);
  return outcome;
}
