export interface DocPage {
  slug: string;
  file: string;
  title: string;
  part: string;
}

export const docs: DocPage[] = [
  {
    slug: "table-of-contents",
    file: "00-table-of-contents.md",
    title: "Table of Contents",
    part: "Overview",
  },
  {
    slug: "foundations-and-setup",
    file: "01-foundations-and-setup.md",
    title: "Foundations & Setup",
    part: "Part 1",
  },
  {
    slug: "configuration-libraries-providers-boundaries",
    file: "02-configuration-libraries-providers-boundaries.md",
    title: "Config, Libraries, Providers & Boundaries",
    part: "Part 2",
  },
  {
    slug: "features-workflow-communication-styles",
    file: "03-features-workflow-communication-styles.md",
    title: "Features, Workflow, Communication & Styles",
    part: "Part 3",
  },
  {
    slug: "deployment-versions-testing",
    file: "04-deployment-versions-testing.md",
    title: "Deployment, Versions & Testing",
    part: "Part 4",
  },
  {
    slug: "advanced-and-best-practices",
    file: "05-advanced-and-best-practices.md",
    title: "Advanced Patterns & Best Practices",
    part: "Part 5",
  },
];
