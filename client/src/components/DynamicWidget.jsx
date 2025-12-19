import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';
import { useReactTable, getCoreRowModel, flexRender } from '@tanstack/react-table';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export const DynamicWidget = ({ type, data, config }) => {
    if (!data) return null;

    if (type === 'chart') {
        const ChartComponent = config?.chartType === 'bar' ? BarChart :
            config?.chartType === 'pie' ? PieChart : LineChart;

        return (
            <div className="w-full h-72 bg-slate-900/50 rounded-xl border border-slate-800 p-4 my-4">
                <h4 className="text-sm font-medium text-slate-400 mb-4">{config?.title || 'Data Visualization'}</h4>
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
        );
    }

    if (type === 'table') {
        // Simple table rendering logic. Real impl would use TanStack table hooks properly for columns.
        const columns = Object.keys(data[0] || {}).map(key => ({ header: key, accessorKey: key }));

        return (
            <div className="w-full overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50 my-4">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-slate-400">
                        <thead className="text-xs text-slate-200 uppercase bg-slate-800/50">
                            <tr>
                                {columns.map(col => <th key={col.header} className="px-6 py-3">{col.header}</th>)}
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, i) => (
                                <tr key={i} className="border-b border-slate-800 hover:bg-slate-800/30">
                                    {columns.map(col => <td key={col.header} className="px-6 py-4">{row[col.accessorKey]}</td>)}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    }

    if (type === 'stat') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
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
        );
    }

    if (type === 'insight') {
        return (
            <div className="bg-gradient-to-br from-indigo-900/40 to-slate-900/40 p-6 rounded-2xl border border-indigo-500/30 backdrop-blur-sm my-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                    <div className="w-24 h-24 bg-indigo-500 rounded-full blur-3xl" />
                </div>

                <h4 className="text-lg font-semibold text-indigo-300 mb-4 flex items-center gap-2">
                    {config?.title || "Key Insights"}
                </h4>

                <div className="space-y-3">
                    {config?.content && Array.isArray(config.content) ? (
                        config.content.map((point, idx) => (
                            <div key={idx} className="flex gap-3 text-slate-300">
                                <span className="text-indigo-400 font-bold">•</span>
                                <p className="leading-relaxed">{point}</p>
                            </div>
                        ))
                    ) : (
                        <p className="text-slate-300 leading-relaxed">
                            {config?.content || "No insights available."}
                        </p>
                    )}
                </div>
            </div>
        );
    }


    return null;
};
