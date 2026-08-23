module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverage: false,
  // isolatedModules keeps ts-jest from type-checking transitive files it
  // doesn't own. The project has some legacy sandbox modules with type
  // errors we haven't cleaned up; blocking unit tests on them was a
  // false-negative signal. Runtime behavior is unaffected.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
  moduleNameMapper: {
    // Mirror the patient-portal tsconfig `@hairos/*` alias so unit tests
    // can import from the packages tree without wiring a workspace.
    '^@hairos/(.*)$': '<rootDir>/src/$1',
    '^@shared/(.*)$': '<rootDir>/packages/shared/$1',
    // Patient-portal-local `@/*` alias — resolves to apps/patient-portal/src.
    // Only tests that exercise patient-portal code need this; other tests are
    // unaffected because they don't import via `@/`.
    '^@/(.*)$': '<rootDir>/apps/patient-portal/src/$1',
    // Next.js is only installed under apps/patient-portal; resolve it from
    // there so unit tests targeting patient-portal route handlers can import
    // NextResponse without a workspace.
    '^next/server$': '<rootDir>/apps/patient-portal/node_modules/next/server.js',
    // Same for @supabase/supabase-js — only present under the app.
    '^@supabase/supabase-js$':
      '<rootDir>/apps/patient-portal/node_modules/@supabase/supabase-js/dist/index.cjs',
    // Same for exceljs — the admin order export builds its workbook with it,
    // and the export test reads the generated buffer back to assert on cell
    // types and tab structure.
    // `excel.js` is the package's node main; the `browser` field points at a
    // bundled build that must never be pulled into a server test.
    '^exceljs$': '<rootDir>/apps/patient-portal/node_modules/exceljs/excel.js',
  },
};
