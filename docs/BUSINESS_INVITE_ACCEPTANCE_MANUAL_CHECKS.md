# Business Invite Acceptance Manual Checks

Use an invite URL shaped like `/invite/business?token=...`.

1. New user opens a valid invite link:
   - sees the public invite page and can continue to registration;
   - registration uses `/login?mode=register&email=...&invite=business-team&next=/invite/business?...`;
   - after registration, the invite is accepted;
   - `User.emailVerifiedAt` is set;
   - `BusinessMember` is created with invite `businessId`, `role`, and `title`;
   - user lands on `/business/team?invite=accepted`.

2. Existing verified user opens a valid invite link:
   - if not logged in, redirected to login with the invite email prefilled;
   - after login, the invite is accepted and user lands on team page.

3. Existing unverified user opens a valid invite link:
   - no `EMAIL_NOT_VERIFIED` JSON is shown;
   - after login or while already logged in, `emailVerifiedAt` is set during acceptance.

4. Revoked invite:
   - browser GET renders a page with `Это приглашение было отозвано.`;
   - no `BusinessMember` is created.

5. Expired invite:
   - browser GET renders `Срок действия приглашения истёк. Попросите владельца бизнеса отправить новое приглашение.`;
   - pending invite is marked `EXPIRED`;
   - no `BusinessMember` is created.

6. Already accepted or otherwise inactive invite:
   - browser GET renders `Приглашение недействительно или уже использовано.`;
   - no duplicate `BusinessMember` is created.

7. User is already an active member and opens a still-pending invite:
   - no duplicate member is created;
   - invite is marked `ACCEPTED`;
   - user lands on `/business/team?invite=already-member`.

8. Email mismatch:
   - logged-in user with a different email sees a normal HTML page asking them to use the invited email;
   - no `BusinessMember` is created for the wrong user.
