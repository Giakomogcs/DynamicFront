import React from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export const ExpandableWidget = ({ title, sections, defaultExpanded = false }) => {
    const [expandedSections, setExpandedSections] = React.useState(
        defaultExpanded ? sections.map((_, i) => i) : []
    );

    const toggleSection = (index) => {
        setExpandedSections(prev =>
            prev.includes(index)
                ? prev.filter(i => i !== index)
                : [...prev, index]
        );
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg">
            <h3 className="text-lg font-semibold text-white mb-4">{title}</h3>
            <div className="space-y-3">
                {sections.map((section, index) => (
                    <div key={index} className="border border-slate-800 rounded-lg overflow-hidden">
                        <button
                            onClick={() => toggleSection(index)}
                            className="w-full flex items-center justify-between p-4 bg-slate-800/50 hover:bg-slate-800 transition-colors text-left"
                        >
                            <span className="font-medium text-slate-200">{section.title}</span>
                            {expandedSections.includes(index) ? (
                                <ChevronDown size={18} className="text-slate-400" />
                            ) : (
                                <ChevronRight size={18} className="text-slate-400" />
                            )}
                        </button>
                        {expandedSections.includes(index) && (
                            <div className="p-4 bg-slate-900/50 animate-fade-in">
                                {section.content && (
                                    <p className="text-sm text-slate-300 mb-3">{section.content}</p>
                                )}
                                {section.data && Array.isArray(section.data) && (
                                    <div className="space-y-2">
                                        {section.data.map((item, i) => (
                                            <div key={i} className="text-xs text-slate-400 pl-4 border-l-2 border-indigo-500/30">
                                                {typeof item === 'string' ? item : JSON.stringify(item)}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
