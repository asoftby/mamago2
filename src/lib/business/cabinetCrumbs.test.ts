import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildBusinessCabinetNavModel,
  isBusinessDashboardPath,
} from "./cabinetCrumbs";

describe("isBusinessDashboardPath", () => {
  it("matches host and prefix dashboard paths", () => {
    assert.equal(isBusinessDashboardPath("/dashboard"), true);
    assert.equal(isBusinessDashboardPath("/business/dashboard"), true);
    assert.equal(isBusinessDashboardPath("/business/dashboard/"), true);
    assert.equal(isBusinessDashboardPath("/settings"), false);
  });
});

describe("buildBusinessCabinetNavModel", () => {
  it("shows only Кабинет on dashboard without back", () => {
    const model = buildBusinessCabinetNavModel("/dashboard");
    assert.equal(model.showBack, false);
    assert.deepEqual(model.crumbs, [{ label: "Кабинет" }]);
  });

  it("builds nested settings crumbs on path-prefix routes", () => {
    const model = buildBusinessCabinetNavModel("/business/settings/company");
    assert.equal(model.showBack, true);
    assert.deepEqual(model.crumbs, [
      { label: "Кабинет", href: "/business/dashboard" },
      { label: "Настройки", href: "/business/settings" },
      { label: "Компания" },
    ]);
  });

  it("builds nested billing crumbs on host-surface routes", () => {
    const model = buildBusinessCabinetNavModel("/billing/plan");
    assert.deepEqual(model.crumbs, [
      { label: "Кабинет", href: "/dashboard" },
      { label: "Финансы", href: "/billing" },
      { label: "Тариф" },
    ]);
  });

  it("skips dynamic ids for boost and submitted", () => {
    const boost = buildBusinessCabinetNavModel(
      "/business/events/clxxxxxxxxxxxxxxxxxx/boost",
    );
    assert.deepEqual(boost.crumbs, [
      { label: "Кабинет", href: "/business/dashboard" },
      { label: "События", href: "/business/events" },
      { label: "Boost" },
    ]);

    const submitted = buildBusinessCabinetNavModel(
      "/places/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/submitted",
    );
    assert.deepEqual(submitted.crumbs, [
      { label: "Кабинет", href: "/dashboard" },
      { label: "Места", href: "/places" },
      { label: "На модерации" },
    ]);
  });

  it("handles publications nested list", () => {
    const model = buildBusinessCabinetNavModel("/business/publications/events");
    assert.deepEqual(model.crumbs, [
      { label: "Кабинет", href: "/business/dashboard" },
      { label: "Публикации", href: "/business/publications" },
      { label: "События" },
    ]);
  });
});
