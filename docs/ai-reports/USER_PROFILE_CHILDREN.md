# User Profile with Children Support

## Summary

Implemented minimal user profile page at `/me` with children management functionality.

## What Was Implemented

### 1. Database Schema - Child Model

**Added to `prisma/schema.prisma`:**
```prisma
model Child {
  id        String   @id @default(cuid())
  name      String
  birthDate DateTime
  interests String?
  parentId  String

  parent User @relation(fields: [parentId], references: [id], onDelete: Cascade)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([parentId])
}
```

**Updated User model:**
- Added `children Child[]` relation

**Migration:**
- `20260302104531_add_child_model`
- Creates Child table with foreign key to User
- Cascade delete when parent user is deleted

### 2. Profile Page (`src/app/(public)/me/page.tsx`)

**Features:**
- Server component with authentication check
- Redirects to `/login` if not authenticated
- Displays user email
- Shows business link if user has a business
- Lists all children with:
  - Name
  - Age calculation (years or months)
  - Birth date (formatted in Russian)
  - Interests (if provided)
- AddChildForm component for adding new children
- Empty state message when no children

**Age Calculation:**
- Shows months for children under 1 year: "6 мес."
- Shows years for older children: "3 лет"
- Handles edge cases properly

### 3. Add Child Form (`src/app/(public)/me/AddChildForm.tsx`)

**Client Component Features:**
- Uses `useActionState` hook (React 19)
- Three fields:
  - Name (text, required, min 2 chars)
  - Birth Date (date picker, required)
  - Interests (text, optional)
- Loading state during submission
- Field-level validation errors
- General error messages
- Form resets after successful submission (via revalidatePath)

### 4. Server Action (`src/app/(public)/me/actions.ts`)

**`addChildAction` Function:**
- Checks authentication → redirects to `/login` if not authenticated
- Validates input with Zod:
  - name: min 2 characters
  - birthDate: required, validates date format
  - interests: optional string
- Creates child record in database
- Links child to parent via `parentId`
- Revalidates `/me` path to show new child
- Returns typed `ActionState` with errors or success

**Error Handling:**
- ZodError → field-level validation errors
- Invalid date format → user-friendly Russian message
- Generic errors → fallback message

## User Flow

### Viewing Profile
```
1. User visits /me
2. If not authenticated → redirect to /login
3. If authenticated → show profile with:
   - Email
   - Business link (if exists)
   - List of children
   - Add child form
```

### Adding a Child
```
1. User fills out form:
   - Name: "Анна"
   - Birth Date: 2020-05-15
   - Interests: "рисование, танцы"
2. Clicks "Добавить ребёнка"
3. Form shows loading state
4. Server validates and creates child
5. Page revalidates and shows new child in list
6. Form resets for next entry
```

## Technical Details

### Data Model
- Child belongs to User (parent)
- One-to-many relationship (User → Children)
- Cascade delete (deleting user deletes their children)
- Interests stored as simple comma-separated string (no taxonomy yet)

### Validation
- Server-side Zod validation
- Client-side HTML5 validation (required, minLength)
- Date parsing and validation
- Russian error messages

### UI/UX
- Clean, minimal design
- Consistent with existing auth pages
- Responsive layout (max-width container)
- Clear visual hierarchy
- Empty states handled

## Files Created

1. ✅ `prisma/schema.prisma` - Added Child model and User.children relation
2. ✅ `prisma/migrations/20260302104531_add_child_model/migration.sql` - Database migration
3. ✅ `src/app/(public)/me/page.tsx` - Profile page component
4. ✅ `src/app/(public)/me/AddChildForm.tsx` - Client form component
5. ✅ `src/app/(public)/me/actions.ts` - Server action for adding children

## Testing Instructions

### Test 1: Unauthenticated Access
```bash
# Visit /me without being logged in
http://localhost:3000/me

# Expected: Redirects to /login
```

### Test 2: View Profile (No Children)
```bash
# Login as a user with no children
http://localhost:3000/me

# Expected:
- Shows email
- Shows "У вас пока нет добавленных детей"
- Shows add child form
```

### Test 3: Add Child
```bash
# Fill out form:
- Name: "Мария"
- Birth Date: 2021-03-10
- Interests: "музыка, спорт"

# Click "Добавить ребёнка"

# Expected:
- Form shows loading state
- Page reloads with new child in list
- Child shows: name, age, birth date, interests
- Form is reset and ready for next entry
```

### Test 4: Add Multiple Children
```bash
# Add first child
# Add second child
# Add third child

# Expected:
- All children appear in list
- Ordered by creation date (newest first)
- Each child has correct age calculation
```

### Test 5: Validation Errors
```bash
# Test 1: Empty name
- Leave name empty
- Submit form
- Expected: Browser validation error

# Test 2: Short name
- Enter "A"
- Submit form
- Expected: "Имя должно содержать минимум 2 символа"

# Test 3: No birth date
- Leave birth date empty
- Submit form
- Expected: Browser validation error
```

### Test 6: Business Link
```bash
# Login as user with business
http://localhost:3000/me

# Expected:
- Shows "Бизнес: [Business Name] →"
- Link navigates to /business
```

### Test 7: Age Calculation
```bash
# Add child born 6 months ago
# Expected: Shows "6 мес."

# Add child born 2 years ago
# Expected: Shows "2 лет"

# Add child born 2 years and 3 months ago
# Expected: Shows "2 лет"
```

## Future Enhancements

### Not Implemented Yet (As Per Requirements)
- ❌ Edit child functionality
- ❌ Delete child functionality
- ❌ Interests taxonomy (currently simple string)
- ❌ Child profile pictures
- ❌ Age-based activity recommendations

### Potential Future Features
1. **Edit/Delete Children**
   - Edit button on each child card
   - Delete confirmation modal
   - Update server actions

2. **Interests Taxonomy**
   - Predefined interest categories
   - Multi-select dropdown
   - Interest-based filtering

3. **Enhanced Profile**
   - User avatar upload
   - Phone number
   - Location/city
   - Notification preferences

4. **Child Details Page**
   - `/me/children/[id]` route
   - Full child profile
   - Activity history
   - Saved favorites

5. **Activity Recommendations**
   - Age-appropriate suggestions
   - Interest-based filtering
   - Personalized feed

## Security Considerations

✅ Authentication required for all operations
✅ Children scoped to parent user (parentId)
✅ Cascade delete on user deletion
✅ Server-side validation
✅ No direct child ID access (always via parent)
✅ SQL injection protected (Prisma ORM)

## Accessibility

✅ Semantic HTML structure
✅ Proper form labels
✅ Required field indicators
✅ Error messages associated with fields
✅ Keyboard navigation support
✅ Date picker native browser control

## Performance

✅ Server-side rendering (RSC)
✅ Single database query for children
✅ Indexed foreign key (parentId)
✅ Minimal client JavaScript
✅ Progressive enhancement

## Notes

- Interests are stored as simple comma-separated string for MVP
- No pagination yet (assumes reasonable number of children per user)
- Age calculation is approximate (doesn't account for exact days)
- Date format uses Russian locale (toLocaleDateString("ru-RU"))
- Form clears automatically after successful submission via revalidatePath
- Build successful with 36 routes generated
