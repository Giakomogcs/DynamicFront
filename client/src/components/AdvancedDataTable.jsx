/**
 * AdvancedDataTable - Tabela interativa com sorting, filtering, pagination
 * Features: Sort, filter, pagination, row selection, export, collapsible rows
 */

import React, { useState, useMemo } from 'react';
import {
    Box,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TablePagination,
    TableSortLabel,
    Paper,
    TextField,
    IconButton,
    Checkbox,
    Toolbar,
    Typography,
    Tooltip,
    Chip,
    Collapse,
    Button,
    Menu,
    MenuItem
} from '@mui/material';
import {
    Search as SearchIcon,
    FilterList as FilterListIcon,
    GetApp as GetAppIcon,
    Delete as DeleteIcon,
    ExpandMore as ExpandMoreIcon,
    ExpandLess as ExpandLessIcon,
    MoreVert as MoreVertIcon
} from '@mui/icons-material';

const AdvancedDataTable = ({
    columns,
    data,
    title,
    onRowClick,
    renderExpandedRow,
    selectable = false,
    onDelete,
    exportable = true
}) => {
    const [page, setPage] = useState(0);
    const [rowsPerPage, setRowsPerPage] = useState(10);
    const [orderBy, setOrderBy] = useState('');
    const [order, setOrder] = useState('asc');
    const [searchTerm, setSearchTerm] = useState('');
    const [selected, setSelected] = useState([]);
    const [expandedRows, setExpandedRows] = useState({});
    const [anchorEl, setAnchorEl] = useState(null);

    // Sorting
    const handleSort = (columnId) => {
        const isAsc = orderBy === columnId && order === 'asc';
        setOrder(isAsc ? 'desc' : 'asc');
        setOrderBy(columnId);
    };

    // Filtering & Sorting
    const filteredData = useMemo(() => {
        let filtered = data.filter((row) =>
            columns.some((column) => {
                const value = row[column.id];
                return value?.toString().toLowerCase().includes(searchTerm.toLowerCase());
            })
        );

        if (orderBy) {
            filtered = filtered.sort((a, b) => {
                const aVal = a[orderBy];
                const bVal = b[orderBy];

                if (order === 'asc') {
                    return aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
                } else {
                    return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
                }
            });
        }

        return filtered;
    }, [data, searchTerm, orderBy, order, columns]);

    // Pagination
    const paginatedData = filteredData.slice(
        page * rowsPerPage,
        page * rowsPerPage + rowsPerPage
    );

    const handleChangePage = (event, newPage) => {
        setPage(newPage);
    };

    const handleChangeRowsPerPage = (event) => {
        setRowsPerPage(parseInt(event.target.value, 10));
        setPage(0);
    };

    // Selection
    const handleSelectAll = (event) => {
        if (event.target.checked) {
            const newSelected = paginatedData.map((row, index) => index);
            setSelected(newSelected);
        } else {
            setSelected([]);
        }
    };

    const handleSelect = (index) => {
        const selectedIndex = selected.indexOf(index);
        let newSelected = [];

        if (selectedIndex === -1) {
            newSelected = [...selected, index];
        } else {
            newSelected = selected.filter((i) => i !== selectedIndex);
        }

        setSelected(newSelected);
    };

    const isSelected = (index) => selected.indexOf(index) !== -1;

    // Expand row
    const toggleExpand = (index) => {
        setExpandedRows((prev) => ({
            ...prev,
            [index]: !prev[index]
        }));
    };

    // Export
    const handleExport = () => {
        const csv = [
            columns.map(col => col.label).join(','),
            ...filteredData.map(row =>
                columns.map(col => row[col.id]).join(',')
            )
        ].join('\n');

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title || 'data'}.csv`;
        a.click();
    };

    // Delete selected
    const handleDeleteSelected = () => {
        if (onDelete) {
            const selectedRows = selected.map(index => paginatedData[index]);
            onDelete(selectedRows);
            setSelected([]);
        }
    };

    return (
        <Paper>
            <Toolbar sx={{ pl: { sm: 2 }, pr: { xs: 1, sm: 1 } }}>
                {selected.length > 0 ? (
                    <Typography
                        sx={{ flex: '1 1 100%' }}
                        color="inherit"
                        variant="subtitle1"
                        component="div"
                    >
                        {selected.length} selecionado(s)
                    </Typography>
                ) : (
                    <Typography
                        sx={{ flex: '1 1 100%' }}
                        variant="h6"
                        component="div"
                    >
                        {title}
                    </Typography>
                )}

                <Box display="flex" gap={1}>
                    <TextField
                        size="small"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        InputProps={{
                            startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />
                        }}
                    />

                    {selected.length > 0 && onDelete && (
                        <Tooltip title="Deletar selecionados">
                            <IconButton onClick={handleDeleteSelected} color="error">
                                <DeleteIcon />
                            </IconButton>
                        </Tooltip>
                    )}

                    {exportable && (
                        <Tooltip title="Exportar CSV">
                            <IconButton onClick={handleExport}>
                                <GetAppIcon />
                            </IconButton>
                        </Tooltip>
                    )}

                    <Tooltip title="Filtros">
                        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)}>
                            <FilterListIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
            </Toolbar>

            <TableContainer>
                <Table>
                    <TableHead>
                        <TableRow>
                            {renderExpandedRow && <TableCell width={50} />}
                            {selectable && (
                                <TableCell padding="checkbox">
                                    <Checkbox
                                        indeterminate={selected.length > 0 && selected.length < paginatedData.length}
                                        checked={paginatedData.length > 0 && selected.length === paginatedData.length}
                                        onChange={handleSelectAll}
                                    />
                                </TableCell>
                            )}
                            {columns.map((column) => (
                                <TableCell
                                    key={column.id}
                                    sortDirection={orderBy === column.id ? order : false}
                                >
                                    {column.sortable !== false ? (
                                        <TableSortLabel
                                            active={orderBy === column.id}
                                            direction={orderBy === column.id ? order : 'asc'}
                                            onClick={() => handleSort(column.id)}
                                        >
                                            {column.label}
                                        </TableSortLabel>
                                    ) : (
                                        column.label
                                    )}
                                </TableCell>
                            ))}
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {paginatedData.map((row, index) => {
                            const isItemSelected = isSelected(index);

                            return (
                                <React.Fragment key={index}>
                                    <TableRow
                                        hover
                                        onClick={() => onRowClick && onRowClick(row)}
                                        selected={isItemSelected}
                                        sx={{ cursor: onRowClick ? 'pointer' : 'default' }}
                                    >
                                        {renderExpandedRow && (
                                            <TableCell>
                                                <IconButton
                                                    size="small"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        toggleExpand(index);
                                                    }}
                                                >
                                                    {expandedRows[index] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                </IconButton>
                                            </TableCell>
                                        )}
                                        {selectable && (
                                            <TableCell padding="checkbox">
                                                <Checkbox
                                                    checked={isItemSelected}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleSelect(index);
                                                    }}
                                                />
                                            </TableCell>
                                        )}
                                        {columns.map((column) => (
                                            <TableCell key={column.id}>
                                                {column.render ? column.render(row[column.id], row) : row[column.id]}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    {renderExpandedRow && (
                                        <TableRow>
                                            <TableCell colSpan={columns.length + (selectable ? 2 : 1)} sx={{ p: 0 }}>
                                                <Collapse in={expandedRows[index]}>
                                                    <Box p={2} bgcolor="grey.50">
                                                        {renderExpandedRow(row)}
                                                    </Box>
                                                </Collapse>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            );
                        })}
                        {paginatedData.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={columns.length + (selectable ? 2 : 1)} align="center">
                                    <Typography color="text.secondary" py={4}>
                                        Nenhum registro encontrado
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>

            <TablePagination
                rowsPerPageOptions={[5, 10, 25, 50]}
                component="div"
                count={filteredData.length}
                rowsPerPage={rowsPerPage}
                page={page}
                onPageChange={handleChangePage}
                onRowsPerPageChange={handleChangeRowsPerPage}
                labelRowsPerPage="Linhas por página:"
                labelDisplayedRows={({ from, to, count }) =>
                    `${from}-${to} de ${count !== -1 ? count : `more than ${to}`}`
                }
            />

            {/* Filter Menu */}
            <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem onClick={() => setAnchorEl(null)}>Status: Todos</MenuItem>
                <MenuItem onClick={() => setAnchorEl(null)}>Status: Ativo</MenuItem>
                <MenuItem onClick={() => setAnchorEl(null)}>Status: Inativo</MenuItem>
            </Menu>
        </Paper>
    );
};

export default AdvancedDataTable;
