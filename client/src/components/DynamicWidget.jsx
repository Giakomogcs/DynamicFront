import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { ExpandableWidget } from './ExpandableWidget';
import { ExternalLink, Play, ArrowRight, MousePointer2, RefreshCw } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const DynamicWidget = ({ type, data, config, title, sections, items, steps, content, sentiment, actions, dataSource, onAction, onNavigateScreen, onRefresh }) => {

    // --- Helper: Render Action Buttons ---
    const renderActions = (actionList) => {
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
            config?.chartType === 'pie' ? PieChart : LineChart;

        return (
            <div className="w-full h-80 bg-slate-900/50 rounded-xl border border-slate-800 p-4 my-4 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                    <h4 className="text-sm font-medium text-slate-400">{config?.title || 'Data Visualization'}</h4>
                    <div className="flex items-center gap-2">
                        {renderRefreshButton()}
                        {config?.navigationTarget && (
                            <button
                                onClick={() => onNavigateScreen && onNavigateScreen(config.navigationTarget)}
                                className="text-xs bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-2 py-1 rounded border border-indigo-500/20 transition-colors"
                            >
                                View Details →
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 min-h-0">
                    <ResponsiveContainer width="100%" height="100%">
                        <ChartComponent data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                            <XAxis dataKey="name" stroke="#64748b" fontSize={12} />
                            <YAxis stroke="#64748b" fontSize={12} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f1f5f9' }}
                                itemStyle={{ color: '#e2e8f0' }}
                            />
                            <Legend />
                            {config?.chartType === 'bar' && (
                                <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                            )}
                            {config?.chartType === 'line' && (
                                <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                            )}
                            {config?.chartType === 'pie' && (
                                <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} fill="#8884d8" label>
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

        return (
            <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 my-4 flex flex-col">
                <div className="p-4 border-b border-slate-800/50 flex justify-between items-center bg-slate-800/20">
                    <h4 className="text-sm font-semibold text-slate-200">{title || "Data Table"}</h4>
                    {renderRefreshButton()}
                </div>
                <div className="overflow-x-auto max-h-[400px]">
                    <table className="w-full text-sm text-left text-slate-400">
                        <thead className="text-xs text-slate-200 uppercase bg-slate-800/50 sticky top-0 backdrop-blur-sm">
                            <tr>
                                {columns.map(col => <th key={col.header} className="px-6 py-3">{col.header}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, i) => (
                                <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                                    {columns.map(col => <td key={col.header} className="px-6 py-4 truncate max-w-xs" title={row[col.accessorKey]}>{row[col.accessorKey]}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {widgetActions.length > 0 && <div className="p-4 bg-slate-900">{renderActions(widgetActions)}</div>}
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
