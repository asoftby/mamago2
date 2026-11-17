// The unbundled `next/navigation` entry includes client hooks. Next's compiler
// aliases it to a server-only entry in Server Actions; a direct Node/tsx test
// does not apply that alias and would load React.createContext from react-server.
// Scope this resolver to the integration-test runner, not application runtime.
import { AsyncLocalStorage } from "node:async_hooks";
import { registerHooks } from "node:module";

// Next's node-environment baseline provides this global in the application
// runtime. Supply it before importing Next modules in the isolated test runner.
// Without it Next silently constructs FakeAsyncLocalStorage, whose run() throws.
globalThis.AsyncLocalStorage ??= AsyncLocalStorage;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "next/navigation") {
      return nextResolve(
        "next/dist/client/components/navigation.react-server.js",
        context,
      );
    }
    return nextResolve(specifier, context);
  },
});
