"use client";

import TextInput from "../../../components/textinput/TextInput.jsx";

export default function ComposerContentInput({
  value,
  placeholder,
  disabled = false,
  onChange,
  inputClassName = "text-[15px]",
}) {
  return (
    <TextInput
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      inputClassName={inputClassName}
      onChange={onChange}
    />
  );
}

