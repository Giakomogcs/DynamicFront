
const models = [
    { name: "models/gemini-2.5-flash-image-preview", displayName: "Nano Banana" },
    { name: "models/gemini-2.0-flash", displayName: "Gemini 2.0 Flash" },
    { name: "models/deep-research-pro", displayName: "Deep Research Pro" }
];

const filtered = models.filter(m => {
    const lowerName = (m.name + (m.displayName || "")).toLowerCase();
    return !lowerName.includes("banana") && !lowerName.includes("deepsearch") && !lowerName.includes("deep research");
});

console.log("Original length:", models.length);
console.log("Filtered length:", filtered.length);
console.log("Filtered models:", JSON.stringify(filtered, null, 2));
