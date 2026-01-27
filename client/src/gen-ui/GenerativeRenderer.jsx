import React, { Suspense } from 'react';
import { ComponentRegistry } from './ComponentRegistry.jsx';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";

// Safe recursive renderer
const RenderNode = ({ node, depth = 0 }) => {
    if (depth > 50) return <Alert variant="destructive"><AlertTitle>Error</AlertTitle><AlertDescription>Max recursion depth exceeded</AlertDescription></Alert>;
    if (!node) return null;

    // Handle Strings/Primitives
    if (typeof node === 'string' || typeof node === 'number') {
        return <span>{node}</span>;
    }

    // Handle Arrays (Fragments)
    if (Array.isArray(node)) {
        return <>{node.map((child, i) => <RenderNode key={i} node={child} depth={depth + 1} />)}</>;
    }

    const { type, props = {}, children } = node;

    const Component = ComponentRegistry[type?.toLowerCase()];

    if (!Component) {
        // Fallback for unknown components -> Render useful error or generic box
        return (
            <Alert variant="warning" className="mb-2">
                <AlertTitle>Unknown Component</AlertTitle>
                <AlertDescription>Agent requested unknown component: <strong>{type}</strong></AlertDescription>
            </Alert>
        );
    }

    // Recursive children rendering
    const renderedChildren = children ? <RenderNode node={children} depth={depth + 1} /> : null;

    // Inject props and children
    return <Component {...props}>{renderedChildren}</Component>;
};

export const GenerativeRenderer = ({ data }) => {
    if (!data) return null;

    return (
        <div className="generative-ui-root animate-in fade-in duration-500">
            <Suspense fallback={<Skeleton className="h-[200px] w-full rounded-xl" />}>
                <RenderNode node={data} />
            </Suspense>
        </div>
    );
};
