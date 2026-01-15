import React, { useState, useCallback } from 'react';
import './DynamicCanvasManager.css';

/**
 * Gerencia múltiplos canvas com navegação, reordenação e edição in-place
 */
export function DynamicCanvasManager() {
    const [canvases, setCanvases] = useState([]);
    const [activeCanvasId, setActiveCanvasId] = useState(null);
    const [groups, setGroups] = useState(new Map());

    /**
     * Adicionar novo canvas
     */
    const addCanvas = useCallback((title, type = 'inference') => {
        const id = `canvas_${Date.now()}`;
        const newCanvas = {
            id,
            title,
            type,
            components: [],
            createdAt: new Date(),
            groupId: null
        };

        setCanvases(prev => [...prev, newCanvas]);
        setActiveCanvasId(id);
        return id;
    }, []);

    /**
     * Atualizar canvas (edição in-place)
     */
    const updateCanvas = useCallback((canvasId, updates) => {
        setCanvases(prev =>
            prev.map(c =>
                c.id === canvasId ? { ...c, ...updates } : c
            )
        );
    }, []);

    /**
     * Adicionar componente ao canvas
     */
    const addComponent = useCallback((canvasId, component) => {
        setCanvases(prev =>
            prev.map(c => {
                if (c.id === canvasId) {
                    return {
                        ...c,
                        components: [
                            ...c.components,
                            {
                                id: `comp_${Date.now()}`,
                                ...component
                            }
                        ]
                    };
                }
                return c;
            })
        );
    }, []);

    /**
     * Atualizar componente em um canvas
     */
    const updateComponent = useCallback((canvasId, componentId, updates) => {
        setCanvases(prev =>
            prev.map(c => {
                if (c.id === canvasId) {
                    return {
                        ...c,
                        components: c.components.map(comp =>
                            comp.id === componentId ? { ...comp, ...updates } : comp
                        )
                    };
                }
                return c;
            })
        );
    }, []);

    /**
     * Reordenar componentes no canvas
     */
    const reorderComponent = useCallback((canvasId, componentId, direction) => {
        setCanvases(prev =>
            prev.map(c => {
                if (c.id === canvasId) {
                    const components = [...c.components];
                    const idx = components.findIndex(comp => comp.id === componentId);

                    if (direction === 'up' && idx > 0) {
                        [components[idx], components[idx - 1]] = [components[idx - 1], components[idx]];
                    } else if (direction === 'down' && idx < components.length - 1) {
                        [components[idx], components[idx + 1]] = [components[idx + 1], components[idx]];
                    }

                    return { ...c, components };
                }
                return c;
            })
        );
    }, []);

    /**
     * Remover componente
     */
    const removeComponent = useCallback((canvasId, componentId) => {
        setCanvases(prev =>
            prev.map(c => {
                if (c.id === canvasId) {
                    return {
                        ...c,
                        components: c.components.filter(comp => comp.id !== componentId)
                    };
                }
                return c;
            })
        );
    }, []);

    /**
     * Agrupar canvas no menu
     */
    const groupCanvas = useCallback((canvasId, groupName) => {
        setCanvases(prev =>
            prev.map(c =>
                c.id === canvasId ? { ...c, groupId: groupName } : c
            )
        );

        setGroups(prev => {
            const newGroups = new Map(prev);
            if (!newGroups.has(groupName)) {
                newGroups.set(groupName, []);
            }
            if (!newGroups.get(groupName).includes(canvasId)) {
                newGroups.get(groupName).push(canvasId);
            }
            return newGroups;
        });
    }, []);

    /**
     * Remover canvas
     */
    const removeCanvas = useCallback((canvasId) => {
        setCanvases(prev => prev.filter(c => c.id !== canvasId));
        if (activeCanvasId === canvasId) {
            setActiveCanvasId(canvases[0]?.id || null);
        }
    }, [activeCanvasId, canvases]);

    // Agrupar canvas por groupId
    const groupedCanvases = {};
    canvases.forEach(canvas => {
        const groupId = canvas.groupId || 'Ungrouped';
        if (!groupedCanvases[groupId]) {
            groupedCanvases[groupId] = [];
        }
        groupedCanvases[groupId].push(canvas);
    });

    const activeCanvas = canvases.find(c => c.id === activeCanvasId);

    return (
        <div className="dynamic-canvas-manager">
            {/* SIDEBAR - Menu com Canvas Agrupados */}
            <div className="dcm-sidebar">
                <div className="dcm-sidebar-header">
                    <h3>📊 Canvases</h3>
                    <button className="dcm-btn-add" onClick={() => addCanvas('New Canvas')}>
                        +
                    </button>
                </div>

                <div className="dcm-groups">
                    {Object.entries(groupedCanvases).map(([groupName, items]) => (
                        <div key={groupName} className="dcm-group">
                            <div className="dcm-group-title">
                                <span>📁 {groupName}</span>
                                <span className="dcm-count">{items.length}</span>
                            </div>
                            <ul className="dcm-group-items">
                                {items.map(canvas => (
                                    <li
                                        key={canvas.id}
                                        className={`dcm-item ${activeCanvasId === canvas.id ? 'active' : ''}`}
                                        onClick={() => setActiveCanvasId(canvas.id)}
                                    >
                                        <span className="dcm-item-title">{canvas.title}</span>
                                        <div className="dcm-item-actions">
                                            <button
                                                className="dcm-btn-sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    removeCanvas(canvas.id);
                                                }}
                                            >
                                                ✕
                                            </button>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="dcm-content">
                {activeCanvas ? (
                    <>
                        {/* Canvas Header */}
                        <div className="dcm-header">
                            <h2>
                                <input
                                    type="text"
                                    value={activeCanvas.title}
                                    onChange={(e) =>
                                        updateCanvas(activeCanvas.id, { title: e.target.value })
                                    }
                                    className="dcm-title-edit"
                                />
                            </h2>
                            <div className="dcm-header-info">
                                <span>{activeCanvas.type}</span>
                                <span>{activeCanvas.components.length} components</span>
                            </div>
                        </div>

                        {/* Canvas Components */}
                        <div className="dcm-components">
                            {activeCanvas.components.length === 0 ? (
                                <div className="dcm-empty">
                                    <p>No components yet. Add one to get started!</p>
                                    <button onClick={() => addComponent(activeCanvas.id, { type: 'text' })}>
                                        Add Component
                                    </button>
                                </div>
                            ) : (
                                activeCanvas.components.map((component, idx) => (
                                    <DynamicComponentEditor
                                        key={component.id}
                                        component={component}
                                        index={idx}
                                        total={activeCanvas.components.length}
                                        onUpdate={(updates) =>
                                            updateComponent(activeCanvas.id, component.id, updates)
                                        }
                                        onMoveUp={() => reorderComponent(activeCanvas.id, component.id, 'up')}
                                        onMoveDown={() => reorderComponent(activeCanvas.id, component.id, 'down')}
                                        onRemove={() => removeComponent(activeCanvas.id, component.id)}
                                    />
                                ))
                            )}
                        </div>

                        {/* Add Component Button */}
                        <div className="dcm-footer">
                            <button className="dcm-btn-primary" onClick={() => addComponent(activeCanvas.id, { type: 'text' })}>
                                + Add Component
                            </button>
                            <button className="dcm-btn-secondary" onClick={() => groupCanvas(activeCanvas.id, 'My Group')}>
                                Group
                            </button>
                        </div>
                    </>
                ) : (
                    <div className="dcm-empty-state">
                        <h2>No Canvas Selected</h2>
                        <button onClick={() => addCanvas('New Canvas')}>Create First Canvas</button>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * Componente individual editável
 */
function DynamicComponentEditor({
    component,
    index,
    total,
    onUpdate,
    onMoveUp,
    onMoveDown,
    onRemove
}) {
    const [isEditing, setIsEditing] = useState(false);

    return (
        <div className="dcm-component">
            <div className="dcm-component-header">
                <span className="dcm-component-index">{index + 1}</span>
                <span className="dcm-component-type">{component.type}</span>

                <div className="dcm-component-actions">
                    {index > 0 && (
                        <button className="dcm-btn-sm" onClick={onMoveUp} title="Move up">
                            ↑
                        </button>
                    )}
                    {index < total - 1 && (
                        <button className="dcm-btn-sm" onClick={onMoveDown} title="Move down">
                            ↓
                        </button>
                    )}
                    <button
                        className="dcm-btn-sm"
                        onClick={() => setIsEditing(!isEditing)}
                        title="Edit"
                    >
                        {isEditing ? '✓' : '✎'}
                    </button>
                    <button className="dcm-btn-sm dcm-btn-danger" onClick={onRemove} title="Remove">
                        ✕
                    </button>
                </div>
            </div>

            {isEditing && (
                <div className="dcm-component-editor">
                    <textarea
                        value={component.content || ''}
                        onChange={(e) => onUpdate({ content: e.target.value })}
                        placeholder="Component content..."
                        rows="4"
                    />

                    {component.type === 'parameter' && (
                        <>
                            <input
                                type="text"
                                placeholder="Parameter name"
                                value={component.paramName || ''}
                                onChange={(e) => onUpdate({ paramName: e.target.value })}
                            />
                            <input
                                type="number"
                                placeholder="Confidence (0-1)"
                                min="0"
                                max="1"
                                step="0.1"
                                value={component.confidence || 0.5}
                                onChange={(e) => onUpdate({ confidence: parseFloat(e.target.value) })}
                            />
                        </>
                    )}
                </div>
            )}

            {!isEditing && (
                <div className="dcm-component-preview">
                    {component.type === 'parameter' && (
                        <div className="component-parameter">
                            <strong>{component.paramName}</strong>
                            <span className="confidence-badge">
                                {((component.confidence || 0) * 100).toFixed(0)}%
                            </span>
                            <p>{component.content}</p>
                        </div>
                    )}
                    {component.type === 'text' && (
                        <div className="component-text">{component.content}</div>
                    )}
                    {component.type === 'result' && (
                        <div className="component-result">
                            <pre>{component.content}</pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default DynamicCanvasManager;
