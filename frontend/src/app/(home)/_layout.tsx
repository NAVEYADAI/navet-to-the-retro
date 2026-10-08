import { Slot } from 'expo-router';

// The "ראשי" tab is a group so the sprint screens (board / summary / memory game) are real routes
// under it: /team/:teamId/sprint/:sprintId[/summary|/memory] (BUG-33). The tab bar stays mounted
// and "ראשי" stays highlighted; Back/F5/shared links work. <Slot> renders only the active route
// (a <Stack> would keep the dashboard mounted-but-hidden underneath, duplicating its DOM), which
// matches the old behavior where opening a sprint unmounted the dashboard and returning to it
// refetched.
export default function HomeLayout() {
  return <Slot />;
}
