/**
 * IntelligenceDashboard - Dashboard com métricas do sistema de inteligência
 * Features: Charts, stats, performance metrics
 */

import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    Grid,
    Typography,
    LinearProgress,
    Chip,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    IconButton,
    Collapse
} from '@mui/material';
import {
    TrendingUp as TrendingUpIcon,
    Speed as SpeedIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    Psychology as PsychologyIcon,
    Storage as StorageIcon,
    Cached as CachedIcon
} from '@mui/icons-material';

const StatCard = ({ title, value, subtitle, icon: Icon, color = 'primary', trend }) => (
    <Card>
        <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                <Box flex={1}>
                    <Typography color="text.secondary" variant="body2" gutterBottom>
                        {title}
                    </Typography>
                    <Typography variant="h4" component="div" color={`${color}.main`}>
                        {value}
                    </Typography>
                    {subtitle && (
                        <Typography variant="body2" color="text.secondary" mt={1}>
                            {subtitle}
                        </Typography>
                    )}
                    {trend && (
                        <Box display="flex" alignItems="center" mt={1}>
                            <TrendingUpIcon fontSize="small" color={trend > 0 ? 'success' : 'error'} />
                            <Typography variant="body2" color={trend > 0 ? 'success.main' : 'error.main'} ml={0.5}>
                                {trend > 0 ? '+' : ''}{trend}%
                            </Typography>
                        </Box>
                    )}
                </Box>
                {Icon && (
                    <Box
                        sx={{
                            bgcolor: `${color}.light`,
                            borderRadius: 2,
                            p: 1.5,
                            display: 'flex'
                        }}
                    >
                        <Icon sx={{ color: `${color}.main`, fontSize: 32 }} />
                    </Box>
                )}
            </Box>
        </CardContent>
    </Card>
);

const PerformanceChart = ({ data }) => {
    const maxValue = Math.max(...data.map(d => d.value), 100);

    return (
        <Box>
            {data.map((item, index) => (
                <Box key={index} mb={2}>
                    <Box display="flex" justifyContent="space-between" mb={0.5}>
                        <Typography variant="body2">{item.label}</Typography>
                        <Typography variant="body2" fontWeight="medium">{item.value}ms</Typography>
                    </Box>
                    <LinearProgress
                        variant="determinate"
                        value={(item.value / maxValue) * 100}
                        sx={{
                            height: 8,
                            borderRadius: 1,
                            bgcolor: 'grey.200',
                            '& .MuiLinearProgress-bar': {
                                bgcolor: item.value < 1000 ? 'success.main' : item.value < 2000 ? 'warning.main' : 'error.main'
                            }
                        }}
                    />
                </Box>
            ))}
        </Box>
    );
};

const IntelligenceDashboard = () => {
    const [stats, setStats] = useState({
        totalQueries: 1247,
        successRate: 94.2,
        avgExecutionTime: 1350,
        cacheHitRate: 52.3,
        templatesCreated: 34,
        resourcesAnalyzed: 12,
        strategicRetries: 87,
        retrySuccessRate: 73.4
    });

    const [executionHistory, setExecutionHistory] = useState([
        { query: 'Cursos de mecatrônica em SC', time: 890, success: true, cached: true },
        { query: 'Empresas do setor tecnológico', time: 1540, success: true, cached: false },
        { query: 'Dados de contratos ativos', time: 2100, success: false, cached: false },
        { query: 'Lista de escolas SENAI', time: 650, success: true, cached: true }
    ]);

    const [expandedRows, setExpandedRows] = useState({});

    const performanceData = [
        { label: 'Cache Hit (Avg)', value: 650 },
        { label: 'First Execution (Avg)', value: 1350 },
        { label: 'With Retry (Avg)', value: 2200 },
        { label: 'Failed Query (Avg)', value: 3100 }
    ];

    const toggleRow = (index) => {
        setExpandedRows(prev => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    return (
        <Box>
            {/* Main Stats Grid */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Queries Executadas"
                        value={stats.totalQueries.toLocaleString()}
                        subtitle="últimos 7 dias"
                        icon={PsychologyIcon}
                        color="primary"
                        trend={12.5}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Taxa de Sucesso"
                        value={`${stats.successRate}%`}
                        subtitle={`${(stats.totalQueries * stats.successRate / 100).toFixed(0)} queries bem-sucedidas`}
                        icon={CheckCircleIcon}
                        color="success"
                        trend={5.2}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Cache Hit Rate"
                        value={`${stats.cacheHitRate}%`}
                        subtitle="50% mais rápido"
                        icon={CachedIcon}
                        color="info"
                        trend={8.3}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                    <StatCard
                        title="Tempo Médio"
                        value={`${stats.avgExecutionTime}ms`}
                        subtitle="execution time"
                        icon={SpeedIcon}
                        color="warning"
                        trend={-3.1}
                    />
                </Grid>
            </Grid>

            {/* Secondary Stats */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} sm={4}>
                    <Card>
                        <CardHeader
                            title="Templates"
                            subheader={`${stats.templatesCreated} criados`}
                            avatar={<StorageIcon color="primary" />}
                        />
                        <CardContent>
                            <Typography variant="h5" color="primary.main">
                                {stats.templatesCreated}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Estratégias reusáveis salvas
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <Card>
                        <CardHeader
                            title="Resources Analisados"
                            subheader="Semantic analysis"
                            avatar={<PsychologyIcon color="secondary" />}
                        />
                        <CardContent>
                            <Typography variant="h5" color="secondary.main">
                                {stats.resourcesAnalyzed}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Domínios auto-detectados
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} sm={4}>
                    <Card>
                        <CardHeader
                            title="Strategic Retries"
                            subheader={`${stats.retrySuccessRate}% success`}
                            avatar={<TrendingUpIcon color="success" />}
                        />
                        <CardContent>
                            <Typography variant="h5" color="success.main">
                                {stats.strategicRetries}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                Recuperações bem-sucedidas
                            </Typography>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Performance Chart */}
            <Grid container spacing={3} mb={3}>
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardHeader title="Performance por Tipo" />
                        <CardContent>
                            <PerformanceChart data={performanceData} />
                        </CardContent>
                    </Card>
                </Grid>
                <Grid item xs={12} md={6}>
                    <Card>
                        <CardHeader title="Métricas de Qualidade" />
                        <CardContent>
                            <Box mb={3}>
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">Data Quality Score</Typography>
                                    <Typography variant="body2" fontWeight="medium">92%</Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={92}
                                    sx={{ height: 8, borderRadius: 1 }}
                                    color="success"
                                />
                            </Box>
                            <Box mb={3}>
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">Template Match Accuracy</Typography>
                                    <Typography variant="body2" fontWeight="medium">87%</Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={87}
                                    sx={{ height: 8, borderRadius: 1 }}
                                    color="info"
                                />
                            </Box>
                            <Box>
                                <Box display="flex" justifyContent="space-between" mb={1}>
                                    <Typography variant="body2">Canvas Merge Accuracy</Typography>
                                    <Typography variant="body2" fontWeight="medium">81%</Typography>
                                </Box>
                                <LinearProgress
                                    variant="determinate"
                                    value={81}
                                    sx={{ height: 8, borderRadius: 1 }}
                                    color="warning"
                                />
                            </Box>
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* Recent Executions Table */}
            <Card>
                <CardHeader title="Execuções Recentes" />
                <CardContent>
                    <TableContainer component={Paper} variant="outlined">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell width={50}></TableCell>
                                    <TableCell>Query</TableCell>
                                    <TableCell>Tempo</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell>Cache</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {executionHistory.map((execution, index) => (
                                    <React.Fragment key={index}>
                                        <TableRow hover>
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => toggleRow(index)}
                                                >
                                                    {expandedRows[index] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </IconButton>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {execution.query}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={`${execution.time}ms`}
                                                    size="small"
                                                    color={execution.time < 1000 ? 'success' : execution.time < 2000 ? 'warning' : 'error'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    icon={execution.success ? <CheckCircleIcon /> : <ErrorIcon />}
                                                    label={execution.success ? 'Sucesso' : 'Falha'}
                                                    size="small"
                                                    color={execution.success ? 'success' : 'error'}
                                                />
                                            </TableCell>
                                            <TableCell>
                                                {execution.cached && (
                                                    <Chip
                                                        icon={<CachedIcon />}
                                                        label="Cache Hit"
                                                        size="small"
                                                        color="info"
                                                        variant="outlined"
                                                    />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell colSpan={5} sx={{ p: 0 }}>
                                                <Collapse in={expandedRows[index]}>
                                                    <Box p={2} bgcolor="grey.50">
                                                        <Typography variant="subtitle2" gutterBottom>
                                                            Detalhes da Execução
                                                        </Typography>
                                                        <Grid container spacing={2}>
                                                            <Grid item xs={6}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Template Used
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    {execution.cached ? 'Yes (cursos_senai_1768825812724)' : 'No'}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={6}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Retry Attempts
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    {execution.success ? 1 : 3}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={6}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Data Quality
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    {execution.success ? '95%' : 'N/A'}
                                                                </Typography>
                                                            </Grid>
                                                            <Grid item xs={6}>
                                                                <Typography variant="caption" color="text.secondary">
                                                                    Tools Used
                                                                </Typography>
                                                                <Typography variant="body2">
                                                                    {execution.success ? 2 : 3}
                                                                </Typography>
                                                            </Grid>
                                                        </Grid>
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>
        </Box>
    );
};

export default IntelligenceDashboard;
