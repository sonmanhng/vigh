import React, { ReactNode } from 'react';
import Select from 'react-select';

interface SearchableSelectProps {
  value?: any;
  onChange?: (e: any) => void;
  className?: string;
  disabled?: boolean;
  required?: boolean;
  style?: React.CSSProperties;
  children: ReactNode;
}

const customStyles: any = {
  control: (provided, state) => ({
    ...provided,
    minHeight: '2.5rem',
    borderRadius: '8px',
    borderColor: state.isFocused ? 'var(--primary)' : 'var(--border-color)',
    boxShadow: state.isFocused ? '0 0 0 1px var(--primary)' : 'none',
    '&:hover': {
      borderColor: 'var(--primary)'
    },
    backgroundColor: state.isDisabled ? '#F1F5F9' : '#fff'
  }),
  valueContainer: (provided) => ({
    ...provided,
    padding: '0 0.75rem',
  }),
  input: (provided) => ({
    ...provided,
    margin: '0',
    padding: '0',
  }),
  indicatorSeparator: () => ({
    display: 'none',
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    height: '2.5rem',
  }),
  option: (provided, state) => ({
    ...provided,
    backgroundColor: state.isSelected 
      ? 'var(--primary)' 
      : state.isFocused 
        ? 'var(--primary-light)' 
        : 'transparent',
    color: state.isSelected ? '#fff' : 'var(--text-main)',
    cursor: 'pointer',
    '&:active': {
      backgroundColor: 'var(--primary)'
    }
  }),
  menu: (provided) => ({
    ...provided,
    zIndex: 9999
  })
};

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  className = '',
  disabled = false,
  required = false,
  style,
  children
}) => {
  const options: { value: string | number; label: string }[] = [];
  
  const processChildren = (kids: ReactNode) => {
    React.Children.forEach(kids, (child: any) => {
      if (!child) return;
      if (child.type === 'option') {
        const val = child.props.value;
        const label = Array.isArray(child.props.children) 
          ? child.props.children.join('') 
          : String(child.props.children);
        options.push({ value: val, label });
      } else if (child.props && child.props.children) {
        processChildren(child.props.children);
      } else if (Array.isArray(child)) {
        processChildren(child);
      }
    });
  };

  processChildren(children);

  const selectedOption = options.find(opt => String(opt.value) === String(value)) || null;

  // Remove input-field and select-field classes to avoid double borders and padding
  const wrapperClass = className.replace(/\b(input-field|select-field)\b/g, '').trim();

  return (
    <div className={wrapperClass} style={{ position: 'relative', width: '100%', ...style }}>
      <Select
        options={options}
        value={selectedOption}
        onChange={(option) => {
          if (onChange) {
            const e = {
              target: {
                value: option ? option.value : ''
              }
            };
            onChange(e);
          }
        }}
        placeholder="Chọn..."
        styles={customStyles}
        isDisabled={disabled}
        isClearable={!required}
        noOptionsMessage={() => 'Không tìm thấy'}
      />
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ opacity: 0, height: 0, width: 0, position: 'absolute', bottom: 0, left: 0 }}
          value={value || ''}
          onChange={() => {}}
          required={required}
        />
      )}
    </div>
  );
};
