import fs from "node:fs";
const path = "/home/ubuntu/modernite-bipv-platform/client/src/App.tsx";
let source = fs.readFileSync(path, "utf8");
const replacements = [
  ["function RoofPage()", "function BuildingPage()", "return <StepLayout active={4}>", "return <StepLayout active={1}>"],
  ["function BuildingPage()", "function StructuresPage()", "return <StepLayout active={1}>", "return <StepLayout active={2}>"],
  ["function StructuresPage()", "function ProductsPage()", "return <StepLayout active={5}>", "return <StepLayout active={3}>"],
  ["function ProductsPage()", "function useLocationState", "return <StepLayout active={2}>", "return <StepLayout active={4}>"],
  ["function EnergyPage()", "function ResultsPage()", "return <StepLayout active={3}>", "return <StepLayout active={5}>"],
];
for (const [startMarker, endMarker, from, to] of replacements) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Failed to locate segment ${startMarker}`);
  const block = source.slice(start, end);
  if (!block.includes(from)) throw new Error(`Missing expected active index in ${startMarker}`);
  source = source.slice(0, start) + block.replace(from, to) + source.slice(end);
}
fs.writeFileSync(path, source);
