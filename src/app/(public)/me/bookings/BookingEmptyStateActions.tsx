import Link from "next/link";
import { DISCOVERY_INTENT_CONFIG } from "@/lib/discovery/discoveryIntentConfig";
import { IcArrow } from "./components/icons";

interface Props {
  classesButtonClassName: string;
  kudaButtonClassName: string;
}

export function BookingEmptyStateActions({ classesButtonClassName, kudaButtonClassName }: Props) {
  return (
    <>
      {DISCOVERY_INTENT_CONFIG.classes.navigationEnabled ? (
        <Link href="/search" className={classesButtonClassName}>
          Найти занятия
        </Link>
      ) : null}
      <Link href="/minsk/events" className={kudaButtonClassName}>
        Куда пойти <IcArrow />
      </Link>
    </>
  );
}
