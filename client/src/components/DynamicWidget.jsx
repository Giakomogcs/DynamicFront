import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { ExpandableWidget } from './ExpandableWidget';
import { ExternalLink, Play, ArrowRight, MousePointer2, RefreshCw, AlertTriangle } from 'lucide-react';
import { GenerativeRenderer } from '../gen-ui/GenerativeRenderer';
import { ComponentRegistry } from '../gen-ui/ComponentRegistry';

class WidgetErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("Widget Error:", error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="bg-red-900/20 border border-red-900/50 rounded-lg p-4 my-2 flex items-center gap-3">
                    <AlertTriangle className="text-red-500" size={20} />
                    <div>
                        <h4 className="text-sm font-semibold text-red-500">Widget Error</h4>
                        <p className="text-xs text-red-400">Failed to render widget content.</p>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const DynamicWidgetContent = (props) => {
    // Unpack common props but keep 'rest' for GenUI
    const { type, data, config, title, sections, items, steps, content, sentiment, actions, dataSource, onAction, onNavigateScreen, onRefresh, ...rest } = props;

    // --- GEN UI INTEGRATION ---
    if (ComponentRegistry[type] || type === 'root') {
        // Construct the node structure for renderer
        // The 'props' from parent become the properties of this node
        const node = {
            type,
            props: props.props || rest, // Use 'props' field if exists (from JSON), else rest
            children: props.children
        };
        return <GenerativeRenderer data={node} />;
    }

    // --- State for Filters ---
    const [searchTerm, setSearchTerm] = React.useState('');
    const [dateFilter, setDateFilter] = React.useState('');

    // --- Helper: Render Action Buttons ---
    const renderActions = (actionList) => {
        // ... (existing implementation)
        if (!actionList || actionList.length === 0) return null;

        return (
            <div className="flex flex-wrap gap-2 mt-4 pt-3 border-t border-slate-800/50">
                {actionList.map((action, idx) => (
                    <button
                        key={idx}
                        onClick={() => onAction && onAction(action)}
                        className={`
                             flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                             ${action.style === 'primary'
                                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                                : action.style === 'link'
                                    ? 'text-indigo-400 hover:text-indigo-300 hover:underline px-0'
                                    : 'bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700'}
                        `}
                    >
                        {action.type === 'tool_call' && <Play size={10} />}
                        {action.type === 'navigate_canvas' && <ExternalLink size={10} />}
                        {action.label}
                    </button>
                ))}
            </div>
        );
    };

    const renderRefreshButton = () => {
        if (!dataSource || !onRefresh) return null;
        return (
            <button
                onClick={() => onRefresh(dataSource)}
                className="p-1.5 text-slate-500 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-colors"
                title={`Refresh Data (Tool: ${dataSource.tool})`}
            >
                <RefreshCw size={14} />
            </button>
        );
    };

    if (!data && !sections && !items && !steps && !content) return null;

    // Normalize actions from root prop or config
    const widgetActions = actions || config?.actions || [];

    if (type === 'chart') {
        const ChartComponent = config?.chartType === 'bar' ? BarChart :
            config?.chartType === 'pie' ? PieChart :
                config?.chartType === 'area' ? AreaChart : LineChart;

        // Enhanced Chart Config
        const dataKeys = config?.dataKeys || [{ key: "value", color: "#6366f1" }];
        // If simple data, normalkeys
        const isMultiSeries = Array.isArray(config?.series);

        return (
            <div className="w-full h-96 bg-slate-900/50 rounded-xl border border-slate-800 p-6 my-4 flex flex-col shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h4 className="text-base font-semibold text-slate-200">{config?.title || 'Data Visualization'}</h4>
                        {config?.subtitle && <p className="text-xs text-slate-500 mt-1">{config.subtitle}</p>}
                    </div>

                    <div className="flex items-center gap-2">
                        {renderRefreshButton()}
                        {config?.navigationTarget && (
                            <button
                                onClick={() => onNavigateScreen && onNavigateScreen(config.navigationTarget)}
                                className="text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-3 py-1.5 rounded-full border border-indigo-500/20 transition-colors"
                            >
                                View Details →
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-h-0 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ChartComponent data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis
                                dataKey="name"
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                dy={10}
                            />
                            <YAxis
                                stroke="#64748b"
                                fontSize={11}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(1)}k` : value}
                            />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                itemStyle={{ color: '#e2e8f0', fontSize: '12px' }}
                                labelStyle={{ color: '#94a3b8', marginBottom: '8px', fontSize: '12px' }}
                                cursor={{ fill: '#1e293b', opacity: 0.4 }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />

                            {/* Render Series Dynamically */}
                            {config?.chartType === 'area' && (
                                <Area type="monotone" dataKey="value" stroke="#818cf8" fillOpacity={1} fill="url(#colorValue)" />
                            )}

                            {config?.chartType === 'bar' && (
                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={50} />
                            )}

                            {config?.chartType === 'line' && (
                                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 4, fill: '#1e1b4b', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                            )}

                            {config?.chartType === 'pie' && (
                                <Pie
                                    data={data}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    stroke="none"
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                            )}
                        </ChartComponent>
                    </ResponsiveContainer>
                </div>
                {renderActions(widgetActions)}
            </div>
        );
    }

    if (type === 'table') {
        const columns = Object.keys(data[0] || {}).map(key => ({ header: key, accessorKey: key }));

        // Filter Data
        const filteredData = data.filter(row => {
            const matchesSearch = Object.values(row).some(val =>
                String(val).toLowerCase().includes(searchTerm.toLowerCase())
            );
            // Simple date filtering (if row has 'date' or 'createdAt')
            // This is basic; real date filtering requires schema knowledge.
            // For now, let's assume if user uses date filter, we check all date-like fields.
            // But without column metadata, it's risky. 
            // Let's simplified: If dateFilter is set, and we find a key with 'date' in it, filter exactly? 
            // Better: Client-side search is powerful enough for < 100 rows.
            return matchesSearch;
        });

        return (
            <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 my-4 flex flex-col shadow-sm">
                <div className="p-4 border-b border-slate-800/50 flex flex-col gap-4 bg-slate-800/20">
                    <div className="flex justify-between items-center">
                        <h4 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                            {title || "Data Table"}
                            <span className="text-xs font-normal text-slate-500 px-2 py-0.5 bg-slate-800 rounded-full border border-slate-700">
                                {filteredData.length} items
                            </span>
                        </h4>
                        {renderRefreshButton()}
                    </div>

                    {/* Filters */}
                    <div className="flex items-center gap-3">
                        <div className="relative flex-1 max-w-xs">
                            <input
                                type="text"
                                placeholder="Search..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                            />
                        </div>
                        {/* Optional Date Filter Mockup - simplistic for now */}
                        {/* <input type="date" className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-400" /> */}
                    </div>
                </div>

                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm text-left text-slate-400">
                        <thead className="text-xs text-slate-200 uppercase bg-slate-800/50 sticky top-0 backdrop-blur-sm z-10">
                            <tr>
                                {columns.map(col => <th key={col.header} className="px-6 py-3 font-medium tracking-wider">{col.header}</th>)}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/50">
                            {filteredData.map((row, i) => (
                                <tr key={i} className="hover:bg-slate-800/30 transition-colors group">
                                    {columns.map(col => (
                                        <td key={col.header} className="px-6 py-3 whitespace-nowrap group-hover:text-slate-200 transition-colors" title={row[col.accessorKey]}>
                                            {row[col.accessorKey]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                            {filteredData.length === 0 && (
                                <tr>
                                    <td colSpan={columns.length} className="px-6 py-8 text-center text-slate-500 italic">
                                        No results match your search
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {widgetActions.length > 0 && <div className="p-4 bg-slate-900 border-t border-slate-800">{renderActions(widgetActions)}</div>}
            </div>
        );
    }

    if (type === 'stat') {
        return (
            <div className="my-4">
                {dataSource && (
                    <div className="flex justify-end mb-2">
                        {renderRefreshButton()}
                    </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {data.map((stat, i) => (
                        <div key={i} className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <p className="text-sm text-slate-400">{stat.label}</p>
                            <p className="text-2xl font-bold text-white mt-1">{stat.value}</p>
                            {stat.change && (
                                <span className={`text-xs ${stat.change.startsWith('+') ? 'text-green-400' : 'text-red-400'}`}>
                                    {stat.change}
                                </span>
                            )}
                        </div>
                    ))}
                </div>
                {renderActions(widgetActions)}
            </div>
        );
    }

    if (type === 'insight') {
        const sentimentColors = {
            success: 'from-green-900/40 to-slate-900/40 border-green-500/30',
            warning: 'from-yellow-900/40 to-slate-900/40 border-yellow-500/30',
            neutral: 'from-indigo-900/40 to-slate-900/40 border-indigo-500/30'
        };

        return (
            <div className={`bg-gradient-to-br ${sentimentColors[sentiment] || sentimentColors.neutral} p-6 rounded-2xl border backdrop-blur-sm my-4 relative overflow-hidden group`}>
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <div className="w-24 h-24 bg-indigo-500 rounded-full blur-3xl" />
                </div>

                <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-semibold text-indigo-300 flex items-center gap-2">
                        {title || "Key Insights"}
                    </h4>
                    {renderRefreshButton()}
                </div>

                <div className="space-y-3">
                    {content && Array.isArray(content) ? (
                        content.map((point, idx) => (
                            <div key={idx} className="flex gap-3 text-slate-300">
                                <span className="text-indigo-400 font-bold">•</span>
                                <p className="leading-relaxed">{point}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-slate-300 leading-relaxed">
                            {content || "No insights available."}
                        </p>
                    )}
                </div>
                {renderActions(widgetActions)}
            </div>
        );
    }

    if (type === 'process') {
        const statusColors = {
            completed: 'bg-green-500',
            running: 'bg-blue-500 animate-pulse',
            failed: 'bg-red-500',
            pending: 'bg-slate-600'
        };

        return (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 my-4">
                <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-semibold text-white">{title || 'Process'}</h4>
                    {renderRefreshButton()}
                </div>
                <div className="space-y-3">
                    {steps && steps.map((step, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <div className={`w-3 h-3 rounded-full mt-1 ${statusColors[step.status] || statusColors.pending}`} />
                            <div className="flex-1">
                                <p className="text-sm font-medium text-slate-200">{step.name}</p>
                                {step.description && (
                                    <p className="text-xs text-slate-400 mt-1">{step.description}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
                {renderActions(widgetActions)}
            </div>
        );
    }

    if (type === 'expandable') {
        return <ExpandableWidget title={title} sections={sections} />;
    }

    if (type === 'calendar') {
        const [currentDate, setCurrentDate] = React.useState(new Date());

        const getDaysInMonth = (date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            return new Date(year, month + 1, 0).getDate();
        };

        const getFirstDayOfMonth = (date) => {
            const year = date.getFullYear();
            const month = date.getMonth();
            return new Date(year, month, 1).getDay();
        };

        const navigateMonth = (direction) => {
            const newDate = new Date(currentDate);
            newDate.setMonth(currentDate.getMonth() + direction);
            setCurrentDate(newDate);
        };

        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const monthName = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });

        // Data format: [{ date: '2024-03-15', title: 'Event', type: 'warning/success' }]
        const getEventsForDay = (day) => {
            if (!data) return [];
            const year = currentDate.getFullYear();
            const month = currentDate.getMonth(); // 0-indexed
            // Construct YYYY-MM-DD
            // This is simple string matching, ideal for MVP
            const currentString = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            return data.filter(e => e.date === currentString);
        };

        return (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 my-4 shadow-sm">
                <div className="flex justify-between items-center mb-6">
                    <h4 className="text-lg font-semibold text-white capitalize flex items-center gap-2">
                        {title || 'Calendar'}
                        <span className="text-sm font-normal text-slate-400">({monthName})</span>
                    </h4>
                    <div className="flex items-center gap-2">
                        <button onClick={() => navigateMonth(-1)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
                            <ArrowRight className="rotate-180" size={16} />
                        </button>
                        <button onClick={() => navigateMonth(1)} className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors">
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>

                {/* Days Header */}
                <div className="grid grid-cols-7 mb-2 text-center">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-1">{d}</div>
                    ))}
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-1">
                    {/* Empty Slots */}
                    {Array.from({ length: firstDay }).map((_, i) => (
                        <div key={`empty-${i}`} className="h-24 bg-transparent border border-transparent" />
                    ))}

                    {/* Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                        const day = i + 1;
                        const events = getEventsForDay(day);
                        const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

                        return (
                            <div key={day} className={`h-24 border border-slate-800/50 rounded-lg p-2 relative hover:bg-slate-800/20 transition-colors ${isToday ? 'bg-indigo-500/5 border-indigo-500/30' : 'bg-slate-900/30'}`}>
                                <span className={`text-sm font-medium ${isToday ? 'text-indigo-400' : 'text-slate-400'}`}>{day}</span>
                                <div className="mt-1 space-y-1 overflow-y-auto max-h-[calc(100%-20px)] scrollbar-hide">
                                    {events.map((ev, idx) => (
                                        <div key={idx} className={`text-[10px] px-1.5 py-0.5 rounded truncate ${ev.type === 'warning' ? 'bg-orange-500/20 text-orange-300' : ev.type === 'success' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-indigo-500/20 text-indigo-300'}`} title={ev.title}>
                                            {ev.title}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
                {renderActions(widgetActions)}
            </div>
        );
    }

    if (type === 'comparison') {
        return (
            <div className="bg-slate-900/50 rounded-xl border border-slate-800 p-6 my-4">
                <div className="flex justify-between items-start mb-4">
                    <h4 className="text-lg font-semibold text-white">{title || 'Comparison'}</h4>
                    {renderRefreshButton()}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {items && items.map((item, i) => (
                        <div key={i} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
                            <h5 className="font-medium text-slate-200 mb-3">{item.name}</h5>
                            <div className="space-y-2">
                                {item.metrics && Object.entries(item.metrics).map(([key, value]) => (
                                    <div key={key} className="flex justify-between text-sm">
                                        <span className="text-slate-400">{key}:</span>
                                        <span className="text-slate-200 font-medium">{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
                {renderActions(widgetActions)}
            </div>
        );
    }

    return null;
};

// Export wrapper
export const DynamicWidget = (props) => (
    <WidgetErrorBoundary>
        <DynamicWidgetContent {...props} />
    </WidgetErrorBoundary>
);
