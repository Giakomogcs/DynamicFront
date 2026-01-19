/**
 * SensitiveDataField - Component para exibir dados sensíveis com toggle de visibilidade
 * Features: Show/hide, copy to clipboard, masked display
 */

import React, { useState } from 'react';
import {
    Box,
    TextField,
    IconButton,
    InputAdornment,
    Tooltip,
    Snackbar,
    Alert
} from '@mui/material';
import {
    Visibility as VisibilityIcon,
    VisibilityOff as VisibilityOffIcon,
    ContentCopy as ContentCopyIcon
} from '@mui/icons-material';

const SensitiveDataField = ({
    label,
    value,
    maskedCharacter = '•',
    copyable = true,
    ...textFieldProps
}) => {
    const [show, setShow] = useState(false);
    const [copied, setCopied] = useState(false);

    const handleToggle = () => {
        setShow(!show);
    };

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    const handleCloseCopied = () => {
        setCopied(false);
    };

    const maskValue = (val) => {
        if (!val) return '';
        return maskedCharacter.repeat(val.length);
    };

    return (
        <Box>
            <TextField
                fullWidth
                label={label}
                value={show ? value : maskValue(value)}
                InputProps={{
                    readOnly: true,
                    endAdornment: (
                        <InputAdornment position="end">
                            <Tooltip title={show ? 'Ocultar' : 'Mostrar'}>
                                <IconButton
                                    size="small"
                                    onClick={handleToggle}
                                    edge="end"
                                >
                                    {show ? <VisibilityOffIcon /> : <VisibilityIcon />}
                                </IconButton>
                            </Tooltip>
                            {copyable && (
                                <Tooltip title="Copiar">
                                    <IconButton
                                        size="small"
                                        onClick={handleCopy}
                                        edge="end"
                                    >
                                        <ContentCopyIcon />
                                    </IconButton>
                                </Tooltip>
                            )}
                        </InputAdornment>
                    )
                }}
                {...textFieldProps}
            />
            <Snackbar
                open={copied}
                autoHideDuration={2000}
                onClose={handleCloseCopied}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={handleCloseCopied} severity="success" variant="filled">
                    Copiado para área de transferência!
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default SensitiveDataField;
