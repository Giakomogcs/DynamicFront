import { useState, useEffect } from 'react';
import { Box, Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography, Divider, Chip, Collapse } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import BusinessIcon from '@mui/icons-material/Business';
import SchoolIcon from '@mui/icons-material/School';
import FolderIcon from '@mui/icons-material/Folder';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import HomeIcon from '@mui/icons-material/Home';

const DRAWER_WIDTH = 280;

/**
 * CanvasNavigationSidebar
 * 
 * Displays canvas groups organized by theme
 * Allows navigation between different canvas
 */
export function CanvasNavigationSidebar({ conversationId, currentCanvasId, onCanvasSelect }) {
    const [groups, setGroups] = useState([]);
    const [openGroups, setOpenGroups] = useState({});
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadCanvasGroups();
    }, [conversationId]);

    const loadCanvasGroups = async () => {
        try {
            const res = await fetch(`/api/canvas/groups/${conversationId}`);
            const data = await res.json();

            setGroups(data.groups || []);

            // Auto-expand group with current canvas
            const autoOpen = {};
            data.groups.forEach(group => {
                const hasCurrentCanvas = group.canvases.some(c => c.id === currentCanvasId);
                if (hasCurrentCanvas) {
                    autoOpen[group.theme] = true;
                }
            });
            setOpenGroups(autoOpen);

            setLoading(false);
        } catch (error) {
            console.error('Failed to load canvas groups:', error);
            setLoading(false);
        }
    };

    const toggleGroup = (theme) => {
        setOpenGroups(prev => ({
            ...prev,
            [theme]: !prev[theme]
        }));
    };

    const getIconForTheme = (theme) => {
        const lower = theme.toLowerCase();
        if (lower.includes('enterprise') || lower.includes('empresa')) return <BusinessIcon />;
        if (lower.includes('school') || lower.includes('senai')) return <SchoolIcon />;
        if (lower.includes('dashboard')) return <DashboardIcon />;
        return <FolderIcon />;
    };

    return (
        <Drawer
            variant="permanent"
            sx={{
                width: DRAWER_WIDTH,
                flexShrink: 0,
                '& .MuiDrawer-paper': {
                    width: DRAWER_WIDTH,
                    boxSizing: 'border-box',
                    bgcolor: 'background.default',
                    borderRight: '1px solid',
                    borderColor: 'divider'
                }
            }}
        >
            <Box sx={{ p: 2 }}>
                <Typography variant="h6" fontWeight="bold">
                    Canvas Navigator
                </Typography>
                <Typography variant="caption" color="text.secondary">
                    {groups.length} tema(s)
                </Typography>
            </Box>

            <Divider />

            {/* Home */}
            <List>
                <ListItemButton onClick={() => onCanvasSelect(null)}>
                    <ListItemIcon>
                        <HomeIcon />
                    </ListItemIcon>
                    <ListItemText primary="Home" />
                </ListItemButton>
            </List>

            <Divider />

            {/* Canvas Groups */}
            <List sx={{ flexGrow: 1, overflow: 'auto' }}>
                {loading ? (
                    <ListItem>
                        <ListItemText secondary="Carregando..." />
                    </ListItem>
                ) : groups.length === 0 ? (
                    <ListItem>
                        <ListItemText secondary="Nenhum canvas criado" />
                    </ListItem>
                ) : (
                    groups.map((group) => (
                        <Box key={group.theme}>
                            {/* Group Header */}
                            <ListItemButton onClick={() => toggleGroup(group.theme)}>
                                <ListItemIcon>
                                    {getIconForTheme(group.theme)}
                                </ListItemIcon>
                                <ListItemText
                                    primary={group.theme}
                                    secondary={`${group.count} canvas`}
                                />
                                <Chip
                                    label={group.count}
                                    size="small"
                                    sx={{ mr: 1 }}
                                />
                                {openGroups[group.theme] ? <ExpandLess /> : <ExpandMore />}
                            </ListItemButton>

                            {/* Group Items */}
                            <Collapse in={openGroups[group.theme]} timeout="auto" unmountOnExit>
                                <List component="div" disablePadding>
                                    {group.canvases.map((canvas) => (
                                        <ListItemButton
                                            key={canvas.id}
                                            sx={{ pl: 4 }}
                                            selected={canvas.id === currentCanvasId}
                                            onClick={() => onCanvasSelect(canvas.id)}
                                        >
                                            <ListItemText
                                                primary={`Canvas ${canvas.id.substring(0, 8)}`}
                                                secondary={`${canvas.widgetCount} widgets`}
                                                primaryTypographyProps={{ variant: 'body2' }}
                                                secondaryTypographyProps={{ variant: 'caption' }}
                                            />
                                        </ListItemButton>
                                    ))}
                                </List>
                            </Collapse>
                        </Box>
                    ))
                )}
            </List>

            <Divider />

            {/* Footer */}
            <Box sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                    Powered by DynamicFront
                </Typography>
            </Box>
        </Drawer>
    );
}
