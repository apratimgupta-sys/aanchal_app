import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    // Pure logic runs in node; component tests opt into jsdom with a
    // `@vitest-environment jsdom` docblock at the top of the file.
    include: ["tests/domain/**/*.test.ts", "tests/ui/**/*.test.tsx"],
    // Says so, last, when the backend repo is absent and the fixture twin went unchecked.
    globalSetup: ["tests/twin-notice.ts"],
  },
});
