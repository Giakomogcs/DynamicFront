/**
 * AuthProfileManager - Componente para gerenciar perfis de autenticação
 * Features: CRUD, teste de conexão, visualização de dados sensíveis
 */

import React, { useState, useEffect } from 'react';
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    Button,
    TextField,
    IconButton,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Collapse,
    Alert,
    CircularProgress,
    InputAdornment,
    Tooltip,
    Typography,
    Grid
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    CheckCircle as CheckCircleIcon,
    Error as ErrorIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    PlayArrow as PlayArrowIcon
} from '@mui/icons-material';

const AuthProfileManager = ({ resourceId }) => {
    const [profiles, setProfiles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [open, setOpen] = useState(false);
    const [editingProfile, setEditingProfile] = useState(null);
    const [formData, setFormData] = useState({
        label: '',
        role: '',
        description: '',
        credentials: {}
    });
    const [showCredentials, setShowCredentials] = useState({});
    const [expandedRow, setExpandedRow] = useState(null);
    const [testResults, setTestResults] = useState({});
    const [testing, setTesting] = useState({});

    useEffect(() => {
        loadProfiles();
    }, [resourceId]);

    const loadProfiles = async () => {
        try {
            setLoading(true);
            const res = await fetch(`/api/resources/${resourceId}/auth-profiles`);
            const data = await res.json();
            setProfiles(data.profiles || []);
        } catch (error) {
            console.error('Error loading profiles:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleOpen = (profile = null) => {
        if (profile) {
            setEditingProfile(profile);
            setFormData({
                label: profile.label || '',
                role: profile.role || '',
                description: profile.description || '',
                credentials: profile.credentials || {}
            });
        } else {
            setEditingProfile(null);
            setFormData({
                label: '',
                role: '',
                description: '',
                credentials: {}
            });
        }
        setOpen(true);
    };

    const handleClose = () => {
        setOpen(false);
        setEditingProfile(null);
    };

    const handleSave = async () => {
        try {
            const url = editingProfile
                ? `/api/resources/${resourceId}/auth-profiles/${editingProfile.id}`
                : `/api/resources/${resourceId}/auth-profiles`;

            const method = editingProfile ? 'PATCH' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await res.json();

            if (data.success) {
                await loadProfiles();
                handleClose();
            }
        } catch (error) {
            console.error('Error saving profile:', error);
        }
    };

    const handleDelete = async (profileId) => {
        if (!confirm('Tem certeza que deseja remover este perfil?')) return;

        try {
            await fetch(`/api/resources/${resourceId}/auth-profiles/${profileId}`, {
                method: 'DELETE'
            });
            await loadProfiles();
        } catch (error) {
            console.error('Error deleting profile:', error);
        }
    };

    const handleTest = async (profile) => {
        setTesting(prev => ({ ...prev, [profile.id]: true }));

        try {
            const res = await fetch(`/api/resources/${resourceId}/auth-profiles/${profile.id}/test`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ credentials: profile.credentials })
            });

            const data = await res.json();
            setTestResults(prev => ({ ...prev, [profile.id]: data }));
        } catch (error) {
            setTestResults(prev => ({
                ...prev,
                [profile.id]: { success: false, error: error.message }
            }));
        } finally {
            setTesting(prev => ({ ...prev, [profile.id]: false }));
        }
    };

    const toggleShowCredential = (profileId) => {
        setShowCredentials(prev => ({
            ...prev,
            [profileId]: !prev[profileId]
        }));
    };

    const handleCredentialChange = (key, value) => {
        setFormData(prev => ({
            ...prev,
            credentials: {
                ...prev.credentials,
                [key]: value
            }
        }));
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" p={4}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box>
            <Card>
                <CardHeader
                    title="Perfis de Autenticação"
                    subheader={`${profiles.length} perfis configurados`}
                    action={
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={<AddIcon />}
                            onClick={() => handleOpen()}
                        >
                            Novo Perfil
                        </Button>
                    }
                />
                <CardContent>
                    <TableContainer component={Paper} variant="outlined">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell width={50}></TableCell>
                                    <TableCell>Label</TableCell>
                                    <TableCell>Role</TableCell>
                                    <TableCell>Descrição</TableCell>
                                    <TableCell>Status</TableCell>
                                    <TableCell align="right">Ações</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {profiles.map((profile) => (
                                    <React.Fragment key={profile.id}>
                                        <TableRow hover>
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => setExpandedRow(
                                                        expandedRow === profile.id ? null : profile.id
                                                    )}
                                                >
                                                    {expandedRow === profile.id ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </IconButton>
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" fontWeight="medium">
                                                    {profile.label}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={profile.role}
                                                    size="small"
                                                    color="primary"
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2" color="text.secondary">
                                                    {profile.description || '-'}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                {testResults[profile.id] && (
                                                    testResults[profile.id].success ? (
                                                        <Chip
                                                            icon={<CheckCircleIcon />}
                                                            label="Válido"
                                                            color="success"
                                                            size="small"
                                                        />
                                                    ) : (
                                                        <Chip
                                                            icon={<ErrorIcon />}
                                                            label="Erro"
                                                            color="error"
                                                            size="small"
                                                        />
                                                    )
                                                )}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Tooltip title="Testar Conexão">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleTest(profile)}
                                                        disabled={testing[profile.id]}
                                                    >
                                                        {testing[profile.id] ? (
                                                            <CircularProgress size={20} />
                                                        ) : (
                                                            <PlayArrowIcon />
                                                        )}
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Editar">
                                                    <IconButton
                                                        size="small"
                                                        onClick={() => handleOpen(profile)}
                                                    >
                                                        <EditIcon />
                                                    </IconButton>
                                                </Tooltip>
                                                <Tooltip title="Remover">
                                                    <IconButton
                                                        size="small"
                                                        color="error"
                                                        onClick={() => handleDelete(profile.id)}
                                                    >
                                                        <DeleteIcon />
                                                    </IconButton>
                                                </Tooltip>
                                            </TableCell>
                                        </TableRow>
                                        <TableRow>
                                            <TableCell colSpan={6} sx={{ p: 0 }}>
                                                <Collapse in={expandedRow === profile.id}>
                                                    <Box p={2} bgcolor="grey.50">
                                                        <Typography variant="subtitle2" gutterBottom>
                                                            Credenciais
                                                        </Typography>
                                                        <Grid container spacing={2}>
                                                            {Object.entries(profile.credentials || {}).map(([key, value]) => (
                                                                <Grid item xs={12} sm={6} key={key}>
                                                                    <TextField
                                                                        fullWidth
                                                                        size="small"
                                                                        label={key}
                                                                        value={value}
                                                                        type={showCredentials[profile.id] ? 'text' : 'password'}
                                                                        InputProps={{
                                                                            readOnly: true,
                                                                            endAdornment: (
                                                                                <InputAdornment position="end">
                                                                                    <IconButton
                                                                                        size="small"
                                                                                        onClick={() => toggleShowCredential(profile.id)}
                                                                                    >
                                                                                        {showCredentials[profile.id] ? (
                                                                                            <VisibilityOffIcon />
                                                                                        ) : (
                                                                                            <VisibilityIcon />
                                                                                        )}
                                                                                    </IconButton>
                                                                                </InputAdornment>
                                                                            )
                                                                        }}
                                                                    />
                                                                </Grid>
                                                            ))}
                                                        </Grid>
                                                        {testResults[profile.id] && !testResults[profile.id].success && (
                                                            <Alert severity="error" sx={{ mt: 2 }}>
                                                                {testResults[profile.id].error || 'Falha na autenticação'}
                                                            </Alert>
                                                        )}
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    </React.Fragment>
                                ))}
                                {profiles.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} align="center">
                                            <Typography color="text.secondary" py={4}>
                                                Nenhum perfil configurado. Clique em "Novo Perfil" para adicionar.
                                            </Typography>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </CardContent>
            </Card>

            {/* Modal de Edição/Criação */}
            <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingProfile ? 'Editar Perfil' : 'Novo Perfil'}
                </DialogTitle>
                <DialogContent>
                    <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <TextField
                            fullWidth
                            label="Label"
                            value={formData.label}
                            onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                            placeholder="Ex: Admin Principal"
                        />
                        <TextField
                            fullWidth
                            label="Role"
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                            placeholder="Ex: admin, company, user"
                        />
                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Descrição"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Descrição opcional"
                        />
                        <Typography variant="subtitle2" mt={1}>
                            Credenciais
                        </Typography>
                        <TextField
                            fullWidth
                            label="Email"
                            value={formData.credentials.email || ''}
                            onChange={(e) => handleCredentialChange('email', e.target.value)}
                        />
                        <TextField
                            fullWidth
                            type="password"
                            label="Password"
                            value={formData.credentials.password || ''}
                            onChange={(e) => handleCredentialChange('password', e.target.value)}
                        />
                        <TextField
                            fullWidth
                            label="CNPJ (opcional)"
                            value={formData.credentials.cnpj || ''}
                            onChange={(e) => handleCredentialChange('cnpj', e.target.value)}
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleClose}>Cancelar</Button>
                    <Button onClick={handleSave} variant="contained" color="primary">
                        Salvar
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default AuthProfileManager;
