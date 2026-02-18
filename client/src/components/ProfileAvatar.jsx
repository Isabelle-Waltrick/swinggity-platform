import { useLocation } from 'react-router-dom';

/**
 * ProfileAvatar displays a circular avatar with initials or 'V' for visitors.
 * It checks navigation state for firstName, lastName, or visitor flag.
 * Optionally, you can pass firstName, lastName, or visitor as props to override location state.
 */
export default function ProfileAvatar({ firstName, lastName, visitor, size = 40, className = '' }) {
    // Use props if provided, otherwise fallback to location.state
    const location = useLocation();
    const state = location.state || {};
    const _firstName = firstName ?? state.firstName ?? '';
    const _lastName = lastName ?? state.lastName ?? '';
    const _visitor = visitor ?? state.visitor ?? false;

    let initials = 'V';
    if (!_visitor && _firstName && _lastName) {
        initials = `${_firstName[0] || ''}${_lastName[0] || ''}`.toUpperCase();
    }

    return (
        <div
            className={className}
            style={{
                width: size,
                height: size,
                borderRadius: '50%',
                background: '#ff6699',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: size * 0.5,
                color: 'white',
                border: '2px solid #222',
                fontWeight: 600,
                userSelect: 'none',
            }}
        >
            {initials}
        </div>
    );
}
