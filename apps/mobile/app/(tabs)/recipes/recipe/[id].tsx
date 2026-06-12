// The cookbook (Przepisy tab) opens recipe detail within its own stack. The
// screen implementation is shared with the plan tab — re-export it so both tabs
// render the identical W02 view without duplicating logic.
export { default } from '../../plan/recipe/[id]';
