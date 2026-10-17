import assert from "node:assert/strict";
import * as React from "react";
import { render } from "@react-email/render";

import MamagoWelcome from "../../../../emails/mamago-welcome";
import VerifyEmailTemplate from "../templates/verify-email";
import PasswordResetTemplate from "../templates/password-reset";

async function run() {
  const welcome = await render(
    <MamagoWelcome userName="Катя Иванова" ctaUrl="https://mamago.by/me/plan" />,
  );

  // React Email inserts hydration comments between adjacent text fragments.
  const visibleWelcome = welcome.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(visibleWelcome, /Привет, Катя!/);
  assert.match(welcome, /Меньше поисков/);
  assert.match(welcome, /Собрать первый план/);
  assert.match(welcome, /https:\/\/mamago\.by\/me\/plan/);
  assert.match(welcome, /#EF8759/i, "Primary brand color should be used");
  assert.match(welcome, /max-width:600px/i, "Email width should be inbox-friendly");
  assert.match(welcome, /mamaGo.by/);

  const edited = await render(
    <MamagoWelcome
      ctaUrl="https://dev.mamago.by/me/plan"
      introText="Текст приветствия, изменённый в админке."
    />,
  );
  const visibleEdited = edited.replace(/<!--[\s\S]*?-->/g, "");
  assert.match(visibleEdited, /Привет!/);
  assert.doesNotMatch(visibleEdited, /Привет, Катя!/);
  assert.match(edited, /Текст приветствия, изменённый в админке/);
  assert.doesNotMatch(edited, /У нас есть идеи для семейного отдыха/);
  assert.match(edited, /https:\/\/dev\.mamago\.by\/me\/plan/);

  const escaped = await render(
    <MamagoWelcome userName="<script>alert(1)</script>" />,
  );
  assert.doesNotMatch(escaped, /<script>alert\(1\)<\/script>/);
  assert.match(escaped, /&lt;script&gt;/);

  const verify = await render(<VerifyEmailTemplate verifyUrl="https://mamago.by/verify/test" />);
  const reset = await render(<PasswordResetTemplate resetUrl="https://mamago.by/reset/test" />);
  assert.match(verify, /https:\/\/mamago\.by\/verify\/test/);
  assert.match(reset, /https:\/\/mamago\.by\/reset\/test/);
  assert.match(verify, /max-width:600px/i);
  assert.match(reset, /max-width:600px/i);

  console.log("PASS: welcome + auth emails render brand shell, personalization and safe text.");
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
