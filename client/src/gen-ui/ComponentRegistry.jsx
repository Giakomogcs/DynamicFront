import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
// Icon wrapper could be added here if needed, but we'll stick to basics first

// Layout Components
const VStack = ({ children, className, spacing = 2 }) => (
    <div className={`flex flex-col gap-${spacing} ${className || ''}`}>{children}</div>
);

const HStack = ({ children, className, spacing = 2, align = 'center', justify = 'start' }) => (
    <div className={`flex flex-row gap-${spacing} items-${align} justify-${justify} ${className || ''}`}>{children}</div>
);

const Grid = ({ children, className, cols = 3 }) => (
    <div className={`grid grid-cols-1 md:grid-cols-${cols} gap-4 ${className || ''}`}>{children}</div>
);

// Data Components
const DataTable = ({ data, columns }) => {
    if (!data || data.length === 0) return <div className="text-gray-500 italic p-4">No data available</div>;

    // Auto-detect columns if not provided
    const keys = columns || (data[0] ? Object.keys(data[0]) : []);

    return (
        <div className="rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        {keys.map((key) => (
                            <TableHead key={key} className="capitalize">{key.replace(/_/g, ' ')}</TableHead>
                        ))}
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {data.map((row, i) => (
                        <TableRow key={i}>
                            {keys.map((key) => (
                                <TableCell key={key}>{
                                    typeof row[key] === 'object' ? JSON.stringify(row[key]) : row[key] // Safe render
                                }</TableCell>
                            ))}
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};

const KeyValueList = ({ data }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {Object.entries(data).map(([key, value]) => (
            <div key={key} className="flex justify-between border-b py-1">
                <span className="font-medium text-muted-foreground capitalize">{key.replace(/_/g, ' ')}</span>
                <span className="font-semibold">{String(value)}</span>
            </div>
        ))}
    </div>
);


export const ComponentRegistry = {
    // Layouts
    'container': ({ children }) => <div className="container mx-auto p-4">{children}</div>,
    'vstack': VStack,
    'hstack': HStack,
    'grid': Grid,
    'card': ({ title, description, children, footer }) => (
        <Card>
            {(title || description) && (
                <CardHeader>
                    {title && <CardTitle>{title}</CardTitle>}
                    {description && <CardDescription>{description}</CardDescription>}
                </CardHeader>
            )}
            <CardContent>{children}</CardContent>
            {footer && <div className="p-4 pt-0 text-sm text-muted-foreground">{footer}</div>}
        </Card>
    ),

    // Atomic Elements
    'text': ({ content, variant = 'p' }) => {
        const classes = {
            'h1': "text-3xl font-bold tracking-tight",
            'h2': "text-2xl font-semibold tracking-tight",
            'h3': "text-xl font-semibold tracking-tight",
            'p': "leading-7 [&:not(:first-child)]:mt-6",
            'muted': "text-sm text-muted-foreground"
        }[variant] || "";
        return React.createElement(variant === 'muted' ? 'p' : variant, { className: classes }, content);
    },
    'button': ({ label, onClick, variant = 'default' }) => <Button variant={variant} onClick={onClick}>{label}</Button>,
    'input': (props) => <Input {...props} />,
    'alert': ({ title, content, variant = "default" }) => (
        <Alert variant={variant}>
            <AlertTitle>{title}</AlertTitle>
            <AlertDescription>{content}</AlertDescription>
        </Alert>
    ),

    // Data Displays
    'keyvalue': KeyValueList, // Good for details views
    'json': ({ data }) => <pre className="bg-slate-950 text-white p-4 rounded-md overflow-auto max-h-[300px]">{JSON.stringify(data, null, 2)}</pre>
};
