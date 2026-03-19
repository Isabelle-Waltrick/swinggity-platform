import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './TagInput.css';

const TAG_COLORS = [
    'tag-color-1',
    'tag-color-2',
    'tag-color-3',
    'tag-color-4',
    'tag-color-5',
];

function getTagColor(tag, index) {
    // Use a stable hash based on the tag string so the color stays consistent.
    if (typeof index === 'number') return TAG_COLORS[index % TAG_COLORS.length];
    let hash = 0;
    for (let i = 0; i < tag.length; i++) {
        hash = tag.charCodeAt(i) + ((hash << 5) - hash);
    }
    return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length];
}

export default function TagInput({
    selectedTags = [],
    onTagsChange,
    suggestedTags = [],
    maxTags = 20,
    placeholder = 'Type to search...',
}) {
    const [query, setQuery] = useState('');
    const [isOpen, setIsOpen] = useState(false);
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const inputRef = useRef(null);
    const containerRef = useRef(null);
    const dropdownRef = useRef(null);

    // Derived data.
    const trimmedQuery = query.trim();
    const lowerQuery = trimmedQuery.toLowerCase();

    const dropdownItems = useMemo(() => {
        if (!trimmedQuery) return [];

        const items = [];

        // Filter suggested tags that match the query and are not already selected.
        const matchingSuggestions = suggestedTags.filter(
            (tag) =>
                tag.toLowerCase().includes(lowerQuery) &&
                !selectedTags.includes(tag)
        );

        // Always offer Add "query" first unless already selected.
        const exactMatch = suggestedTags.some(
            (tag) => tag.toLowerCase() === lowerQuery
        );
        const alreadySelected = selectedTags.some(
            (tag) => tag.toLowerCase() === lowerQuery
        );

        if (!alreadySelected) {
            items.push({ type: 'create', label: `Add "${trimmedQuery}"`, value: trimmedQuery });
        }

        matchingSuggestions.forEach((tag) => {
            if (exactMatch && tag.toLowerCase() === lowerQuery && !alreadySelected) {
                return;
            }
            items.push({ type: 'suggestion', label: tag, value: tag });
        });

        return items;
    }, [trimmedQuery, lowerQuery, suggestedTags, selectedTags]);

    const availableSuggestions = useMemo(
        () => suggestedTags.filter((tag) => !selectedTags.includes(tag)),
        [suggestedTags, selectedTags]
    );

    const atLimit = selectedTags.length >= maxTags;

    const addTag = useCallback(
        (tag) => {
            if (atLimit) return;
            if (selectedTags.includes(tag)) return;
            onTagsChange([...selectedTags, tag]);
            setQuery('');
            setIsOpen(false);
            setHighlightedIndex(-1);
            inputRef.current?.focus();
        },
        [atLimit, selectedTags, onTagsChange]
    );

    const removeTag = useCallback(
        (tag) => {
            onTagsChange(selectedTags.filter((t) => t !== tag));
            inputRef.current?.focus();
        },
        [selectedTags, onTagsChange]
    );

    const handleInputChange = (event) => {
        setQuery(event.target.value);
        setIsOpen(true);
        setHighlightedIndex(-1);
    };

    const handleInputKeyDown = (event) => {
        if (event.key === 'Backspace' && !query && selectedTags.length > 0) {
            removeTag(selectedTags[selectedTags.length - 1]);
            return;
        }

        if (event.key === 'Escape') {
            setIsOpen(false);
            setHighlightedIndex(-1);
            return;
        }

        if (event.key === 'Enter') {
            event.preventDefault();
            if (highlightedIndex >= 0 && highlightedIndex < dropdownItems.length) {
                addTag(dropdownItems[highlightedIndex].value);
            } else if (trimmedQuery && !atLimit) {
                addTag(trimmedQuery);
            }
            return;
        }

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((prev) =>
                prev < dropdownItems.length - 1 ? prev + 1 : 0
            );
            return;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((prev) =>
                prev > 0 ? prev - 1 : dropdownItems.length - 1
            );
        }
    };

    const handleContainerClick = () => {
        inputRef.current?.focus();
    };

    const toggleDropdown = () => {
        setIsOpen((prev) => !prev);
        inputRef.current?.focus();
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                containerRef.current &&
                !containerRef.current.contains(event.target)
            ) {
                setIsOpen(false);
                setHighlightedIndex(-1);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => {
        if (highlightedIndex >= 0 && dropdownRef.current) {
            const items = dropdownRef.current.querySelectorAll('.tag-dropdown-item');
            items[highlightedIndex]?.scrollIntoView({ block: 'nearest' });
        }
    }, [highlightedIndex]);

    return (
        <div className="tag-input-wrapper" ref={containerRef}>
            <span className="tag-limit-label">Upto {maxTags}</span>

            <div className="tag-input-box-wrap">
                <div
                    className={`tag-input-box ${isOpen ? 'focused' : ''}`}
                    onClick={handleContainerClick}
                >
                    <div className="tag-input-pills">
                        {selectedTags.map((tag, index) => (
                            <span key={tag} className={`tag-input-pill ${getTagColor(tag, index)}`}>
                                <span className="tag-input-pill-label">{tag}</span>
                                <button
                                    type="button"
                                    className="tag-input-pill-remove"
                                    onClick={(event) => {
                                        event.stopPropagation();
                                        removeTag(tag);
                                    }}
                                    aria-label={`Remove ${tag}`}
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        <input
                            ref={inputRef}
                            type="text"
                            className="tag-input-field"
                            value={query}
                            onChange={handleInputChange}
                            onKeyDown={handleInputKeyDown}
                            onFocus={() => query && setIsOpen(true)}
                            placeholder={selectedTags.length === 0 ? placeholder : ''}
                            disabled={atLimit}
                            aria-label="Search tags"
                            autoComplete="off"
                        />
                    </div>

                    <button
                        type="button"
                        className="tag-input-chevron"
                        onClick={(event) => {
                            event.stopPropagation();
                            toggleDropdown();
                        }}
                        tabIndex={-1}
                        aria-label="Toggle suggestions"
                    >
                        <svg
                            width="18"
                            height="18"
                            viewBox="0 0 24 24"
                            fill="none"
                            style={{
                                transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                                transition: 'transform 0.2s ease',
                            }}
                        >
                            <path
                                d="M6 9L12 15L18 9"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </button>
                </div>

                {isOpen && dropdownItems.length > 0 && (
                    <ul className="tag-dropdown" ref={dropdownRef} role="listbox">
                        {dropdownItems.map((item, idx) => (
                            <li
                                key={`${item.type}-${item.value}`}
                                className={`tag-dropdown-item ${item.type === 'create' ? 'create-item' : ''} ${idx === highlightedIndex ? 'highlighted' : ''}`}
                                role="option"
                                aria-selected={idx === highlightedIndex}
                                onMouseEnter={() => setHighlightedIndex(idx)}
                                onMouseDown={(event) => {
                                    event.preventDefault();
                                    addTag(item.value);
                                }}
                            >
                                {item.label}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {availableSuggestions.length > 0 && (
                <>
                    <p className="tag-caption">Suggested Tags</p>
                    <div className="tag-cloud">
                        {availableSuggestions.map((tag) => (
                            <button
                                key={tag}
                                type="button"
                                className={`tag-pill-suggest ${getTagColor(tag)}`}
                                onClick={() => addTag(tag)}
                                disabled={atLimit}
                            >
                                {tag}
                                <span className="tag-pill-plus">+</span>
                            </button>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}
