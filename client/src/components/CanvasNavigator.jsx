/**
 * CanvasNavigator - Navegação entre canvas com visualização de grupos
 * Features: Grouping, navigation, visual indicators
 */

import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    CardActionArea,
    Grid,
    Typography,
    Chip,
    IconButton,
    Divider,
    Badge,
    Breadcrumbs,
    Link
} from '@mui/material';
import {
    Dashboard as DashboardIcon,
    School as SchoolIcon,
    Business as BusinessIcon,
    Description as DescriptionIcon,
    ChevronRight as ChevronRightIcon,
    Home as HomeIcon,
    Star as StarIcon,
    StarBorder as StarBorderIcon
} from '@mui/icons-material';

const CanvasNavigator = ({ currentCanvasId, onNavigate }) => {
    const [canvasGroups, setCanvasGroups] = useState([
        {
            id: 'group-1',
            name: 'Cursos SENAI',
            canvases: [
                { id: 'canvas-1', title: 'Cursos de Mecatrônica', widgetCount: 5, theme: 'Education' },
                { id: 'canvas-2', title: 'Cursos de TI', widgetCount: 3, theme: 'Education' }
            ]
        },
        {
            id: 'group-2',
            name: 'Empresas',
            canvases: [
                { id: 'canvas-3', title: 'Empresas do Sul', widgetCount: 8, theme: 'Enterprise' },
                { id: 'canvas-4', title: 'Contratos Ativos', widgetCount: 4, theme: 'Enterprise' }
            ]
        }
    ]);

    const [favorites, setFavorites] = useState(['canvas-1']);

    const getIconByTheme = (theme) => {
        switch (theme) {
            case 'Education':
                return <SchoolIcon />;
            case 'Enterprise':
                return <BusinessIcon />;
            default:
                return <DashboardIcon />;
        }
    };

    const toggleFavorite = (canvasId) => {
        setFavorites(prev =>
            prev.includes(canvasId)
                ? prev.filter(id => id !== canvasId)
                : [...prev, canvasId]
        );
    };

    return (
        <Box>
            {/* Breadcrumbs */}
            <Breadcrumbs separator={<ChevronRightIcon fontSize="small" />} sx={{ mb: 3 }}>
                <Link
                    color="inherit"
                    href="#"
                    onClick={(e) => {
                        e.preventDefault();
                        onNavigate && onNavigate(null);
                    }}
                    sx={{ display: 'flex', alignItems: 'center' }}
                >
                    <HomeIcon sx={{ mr: 0.5 }} fontSize="small" />
                    Início
                </Link>
                <Typography color="text.primary">Canvas</Typography>
            </Breadcrumbs>

            {/* Canvas Groups */}
            {canvasGroups.map((group) => (
                <Box key={group.id} mb={4}>
                    <Typography variant="h6" gutterBottom>
                        {group.name}
                    </Typography>
                    <Divider sx={{ mb: 2 }} />

                    <Grid container spacing={2}>
                        {group.canvases.map((canvas) => {
                            const isCurrent = canvas.id === currentCanvasId;
                            const isFavorite = favorites.includes(canvas.id);

                            return (
                                <Grid item xs={12} sm={6} md={4} key={canvas.id}>
                                    <Card
                                        variant={isCurrent ? 'elevation' : 'outlined'}
                                        elevation={isCurrent ? 4 : 0}
                                        sx={{
                                            borderColor: isCurrent ? 'primary.main' : 'divider',
                                            borderWidth: isCurrent ? 2 : 1,
                                            position: 'relative' // For absolute positioning of valid actions if needed, or just layout
                                        }}
                                    >
                                        <CardActionArea
                                            onClick={() => onNavigate && onNavigate(canvas.id)}
                                        >
                                            <CardContent>
                                                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                                                    <Box display="flex" alignItems="center" gap={1} flex={1}>
                                                        <Badge
                                                            badgeContent={canvas.widgetCount}
                                                            color="primary"
                                                            max={99}
                                                        >
                                                            {getIconByTheme(canvas.theme)}
                                                        </Badge>
                                                        <Typography variant="subtitle1" fontWeight="medium">
                                                            {canvas.title}
                                                        </Typography>
                                                    </Box>
                                                </Box>

                                                <Box mt={2} display="flex" gap={1}>
                                                    <Chip
                                                        label={canvas.theme}
                                                        size="small"
                                                        variant="outlined"
                                                    />
                                                    {isCurrent && (
                                                        <Chip
                                                            label="Atual"
                                                            size="small"
                                                            color="primary"
                                                        />
                                                    )}
                                                </Box>
                                            </CardContent>
                                        </CardActionArea>
                                        {/* Action Button moved OUTSIDE CardActionArea */}
                                        <Box position="absolute" top={8} right={8} zIndex={10}>
                                            <IconButton
                                                size="small"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleFavorite(canvas.id);
                                                }}
                                            >
                                                {isFavorite ? (
                                                    <StarIcon color="warning" fontSize="small" />
                                                ) : (
                                                    <StarBorderIcon fontSize="small" />
                                                )}
                                            </IconButton>
                                        </Box>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                </Box>
            ))}

            {/* Favorites Section */}
            {favorites.length > 0 && (
                <Box mt={4}>
                    <Typography variant="h6" gutterBottom>
                        <StarIcon color="warning" sx={{ verticalAlign: 'middle', mr: 1 }} />
                        Favoritos
                    </Typography>
                    <Divider sx={{ mb: 2 }} />
                    <Grid container spacing={2}>
                        {favorites.map((favoriteId) => {
                            const canvas = canvasGroups
                                .flatMap(g => g.canvases)
                                .find(c => c.id === favoriteId);

                            if (!canvas) return null;

                            return (
                                <Grid item xs={12} sm={6} md={3} key={canvas.id}>
                                    <Chip
                                        label={canvas.title}
                                        icon={getIconByTheme(canvas.theme)}
                                        onClick={() => onNavigate && onNavigate(canvas.id)}
                                        onDelete={() => toggleFavorite(canvas.id)}
                                        color="primary"
                                        variant="outlined"
                                    />
                                </Grid>
                            );
                        })}
                    </Grid>
                </Box>
            )}
        </Box>
    );
};

export { CanvasNavigator };
export default CanvasNavigator;

