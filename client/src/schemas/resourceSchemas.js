import { z } from 'zod';

// --- API Registration ---
export const apiRegistrationSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    baseUrl: z.string().url("Must be a valid URL (e.g., https://api.example.com)"),
    // Optional specUrl (if mode is URL)
    specUrl: z.string().url("Must be a valid URL").optional().or(z.literal('')),
    // Optional docs content (if mode is Text)
    docsContent: z.string().optional(),
    
    // Auth Config (Simplified for now - we might just validate the JSON string or object structure)
    // Since UI handles this via complex state, we might validate the *result* config
    authConfig: z.string().optional(), // We'll validate the parsed object in logic or refine this
    
    // Documentation Auth
    docsAuthEnabled: z.boolean().optional(),
    docsUsername: z.string().optional(),
    docsPassword: z.string().optional()
}).superRefine((data, ctx) => {
    if (data.docsAuthEnabled) {
        if (!data.docsUsername) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Username is required for docs auth",
                path: ["docsUsername"]
            });
        }
        if (!data.docsPassword) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "Password is required for docs auth",
                path: ["docsPassword"]
            });
        }
    }
});

// --- DB Registration ---
export const dbRegistrationSchema = z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    type: z.enum(['postgres', 'mysql'], { errorMap: () => ({ message: "Please select a database type" }) }),
    connectionString: z.string()
        .min(10, "Connection string too short")
        .includes("://", { message: "Invalid connection string format" })
});

// --- Auth Profile ---
// Used for adding a new user/profile to a resource
export const authProfileSchema = z.object({
    label: z.string().min(2, "Label is required (e.g. 'Admin User')"),
    role: z.string().min(1, "Role is required"),
    
    // Dynamic credentials based on type, but for general validation:
    username: z.string().optional(),
    password: z.string().optional(),
    token: z.string().optional(),
    apiKey: z.string().optional(),
    // We can add superRefine based on selected auth type passed in context if needed
});
