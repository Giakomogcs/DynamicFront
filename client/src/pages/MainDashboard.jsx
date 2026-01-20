/**
 * MainDashboard - Página principal com todas as funcionalidades integradas
 * Features: Navigation, metrics, canvas management, auth profiles
 */

import React, { useState } from 'react';
import {
    Box,
    Container,
    Tabs,
    Tab,
    Paper,
    Typography,
    AppBar,
    Toolbar,
    IconButton,
    Drawer,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,
    Divider,
    Badge,
    Avatar
} from '@mui/material';
import {
    Menu as MenuIcon,
    Dashboard as DashboardIcon,
    ViewModule as ViewModuleIcon,
    Security as SecurityIcon,
    Storage as StorageIcon,
    Assessment as AssessmentIcon,
    Settings as SettingsIcon
} from '@mui/icons-material';

// Import components
import IntelligenceDashboard from './components/IntelligenceDashboard';
import CanvasNavigator from './components/CanvasNavigator';
import AuthProfileManager from './components/AuthProfileManager';
import AdvancedDataTable from './components/AdvancedDataTable';

function TabPanel({ children, value, index, ...other }) {
    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            {...other}
        >
            {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
        </div>
    );
}

const MainDashboard = () => {
    const [currentTab, setCurrentTab] = useState(0);
    const [drawerOpen, setDrawerOpen] = useState(false);
    const [selectedResourceId, setSelectedResourceId] = useState('senai-api');

    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };

    // Mock data for resources table
    const resourcesData = [
        {
            id: 'senai-api',
            name: 'SENAI API',
            type: 'MCP Server',
            status: 'Ativo',
            domain: 'Education',
            tools: 25,
            profiles: 3
        },
        {
            id: 'hospital-api',
            name: 'Hospital API',
            type: 'MCP Server',
            status: 'Ativo',
            domain: 'Healthcare',
            tools: 12,
            profiles: 2
        },
        {
            id: 'ecommerce-db',
            name: 'E-commerce DB',
            type: 'Database',
            status: 'Inativo',
            domain: 'E-commerce',
            tools: 8,
            profiles: 1
        }
    ];

    const resourceColumns = [
        { id: 'name', label: 'Nome' },
        {
            id: 'type',
            label: 'Tipo',
            render: (value) => (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: value === 'MCP Server' ? '#e3f2fd' : '#f3e5f5',
                    fontSize: '0.875rem'
                }}>
                    {value}
                </span>
            )
        },
        {
            id: 'status',
            label: 'Status',
            render: (value) => (
                <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    backgroundColor: value === 'Ativo' ? '#e8f5e9' : '#ffebee',
                    color: value === 'Ativo' ? '#2e7d32' : '#c62828',
                    fontSize: '0.875rem',
                    fontWeight: 500
                }}>
                    {value}
                </span>
            )
        },
        { id: 'domain', label: 'Domínio' },
        { id: 'tools', label: 'Tools' },
        { id: 'profiles', label: 'Perfis' }
    ];

    const menuItems = [
        { icon: <DashboardIcon />, label: 'Dashboard', index: 0 },
        { icon: <ViewModuleIcon />, label: 'Canvas', index: 1 },
        { icon: <StorageIcon />, label: 'Resources', index: 2 },
        { icon: <SecurityIcon />, label: 'Auth Profiles', index: 3 },
        { icon: <AssessmentIcon />, label: 'Analytics', index: 4 }
    ];

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
            {/* Top AppBar */}
            <AppBar position="static" elevation={1}>
                <Toolbar>
                    <IconButton
                        color="inherit"
                        edge="start"
                        onClick={() => setDrawerOpen(true)}
                        sx={{ mr: 2 }}
                    >
                        <MenuIcon />
                    </IconButton>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                        DynamicFront Intelligence
                    </Typography>
                    <Badge badgeContent={3} color="error">
                        <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main' }}>
                            AI
                        </Avatar>
                    </Badge>
                </Toolbar>
            </AppBar>

            {/* Side Drawer */}
            <Drawer
                anchor="left"
                open={drawerOpen}
                onClose={() => setDrawerOpen(false)}
            >
                <Box sx={{ width: 250, pt: 2 }}>
                    <Typography variant="h6" sx={{ px: 2, mb: 2 }}>
                        Menu
                    </Typography>
                    <Divider />
                    <List>
                        {menuItems.map((item) => (
                            <ListItem
                                button
                                key={item.index}
                                selected={currentTab === item.index}
                                onClick={() => {
                                    setCurrentTab(item.index);
                                    setDrawerOpen(false);
                                }}
                            >
                                <ListItemIcon>{item.icon}</ListItemIcon>
                                <ListItemText primary={item.label} />
                            </ListItem>
                        ))}
                    </List>
                    <Divider sx={{ my: 2 }} />
                    <List>
                        <ListItem button>
                            <ListItemIcon><SettingsIcon /></ListItemIcon>
                            <ListItemText primary="Configurações" />
                        </ListItem>
                    </List>
                </Box>
            </Drawer>

            {/* Main Content */}
            <Box sx={{ flexGrow: 1, overflow: 'auto', bgcolor: 'grey.50' }}>
                <Container maxWidth="xl" sx={{ py: 3 }}>
                    {/* Tabs */}
                    <Paper sx={{ mb: 3 }}>
                        <Tabs
                            value={currentTab}
                            onChange={handleTabChange}
                            variant="scrollable"
                            scrollButtons="auto"
                        >
                            <Tab icon={<DashboardIcon />} label="Dashboard" />
                            <Tab icon={<ViewModuleIcon />} label="Canvas" />
                            <Tab icon={<StorageIcon />} label="Resources" />
                            <Tab icon={<SecurityIcon />} label="Auth" />
                            <Tab icon={<AssessmentIcon />} label="Analytics" />
                        </Tabs>
                    </Paper>

                    {/* Tab Panels */}
                    <TabPanel value={currentTab} index={0}>
                        <IntelligenceDashboard />
                    </TabPanel>

                    <TabPanel value={currentTab} index={1}>
                        <CanvasNavigator
                            currentCanvasId="canvas-1"
                            onNavigate={(canvasId) => {
                                console.log('Navigate to canvas:', canvasId);
                            }}
                        />
                    </TabPanel>

                    <TabPanel value={currentTab} index={2}>
                        <AdvancedDataTable
                            title="Resources Registrados"
                            columns={resourceColumns}
                            data={resourcesData}
                            selectable
                            exportable
                            onRowClick={(row) => {
                                setSelectedResourceId(row.id);
                                setCurrentTab(3);
                            }}
                            renderExpandedRow={(row) => (
                                <Box>
                                    <Typography variant="subtitle2" gutterBottom>
                                        Detalhes do Resource
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        ID: {row.id}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Domínio: {row.domain}
                                    </Typography>
                                    <Typography variant="body2" color="text.secondary">
                                        Total de tools disponíveis: {row.tools}
                                    </Typography>
                                </Box>
                            )}
                        />
                    </TabPanel>

                    <TabPanel value={currentTab} index={3}>
                        <Box>
                            <Typography variant="h5" gutterBottom>
                                Gerenciar Autenticação
                            </Typography>
                            <Typography variant="body2" color="text.secondary" paragraph>
                                Resource selecionado: <strong>{selectedResourceId}</strong>
                            </Typography>
                            <AuthProfileManager resourceId={selectedResourceId} />
                        </Box>
                    </TabPanel>

                    <TabPanel value={currentTab} index={4}>
                        <Paper sx={{ p: 3 }}>
                            <Typography variant="h5" gutterBottom>
                                Analytics Avançado
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Visualizações detalhadas de métricas, tendências e performance do sistema.
                            </Typography>
                            {/* Aqui pode adicionar mais gráficos e métricas */}
                            <IntelligenceDashboard />
                        </Paper>
                    </TabPanel>
                </Container>
            </Box>
        </Box>
    );
};

export default MainDashboard;
