import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import IconButton from '@mui/material/IconButton';
import {ArrowBack} from "@mui/icons-material";

export default function ButtonChangePage({ isBack, onClick }) {
    return (
        <IconButton
            onClick={onClick}
            sx={{
                width: 48,
                height: 48,
                backgroundColor: '#FFFFFF',
                borderRadius: '50%',
                zIndex: 5,
                boxShadow: '0 4px 14px rgba(0,0,0,0.08)',
                border: '1px solid rgba(0,0,0,0.05)',
                transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                    backgroundColor: '#f5f5f5',
                    boxShadow: '0 6px 16px rgba(0,0,0,0.15)',
                    transform: 'scale(1.08)',
                },

                '& .MuiSvgIcon-root': {
                    fontSize: 24,
                    color: '#4A4A4A',
                },
            }}
        >
            {isBack ? <ArrowBack /> : <ArrowForwardIcon />}
        </IconButton>
    )
}