import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import IconButton from '@mui/material/IconButton';
import {ArrowBack} from "@mui/icons-material";

export default function ButtonChangePage({ isBack, onClick }) {
    return (
        <IconButton
            onClick={onClick}
            sx={{
                width: 80,
                height: 80,
                backgroundColor: '#FFFFFF',
                borderRadius: '50%',
                '&:hover': {
                    backgroundColor: '#E0E0E0',
                },

                '& .MuiSvgIcon-root': {
                    fontSize: 38,
                    color: '#4A4A4A',
                },
            }}
        >
            {isBack ? <ArrowBack /> : <ArrowForwardIcon />}
        </IconButton>
    )
}