"use client";

import { useId } from "react";

const DEFAULT_LABEL_CLASS =
  "mb-1.5 block text-[13px] font-medium text-slate-600";

export default function TextInput({
  label,
  labelClassName,
  ariaLabel,
  value,
  onChange,
  placeholder = "",
  disabled = false,
  className = "",
  inputClassName = "",
  type = "text",
}) {
  const reactId = useId();
  const inputId = label ? `textinput_${reactId}` : reactId;

  return (
    <div className={className}>
      {label ? (
        <label
          htmlFor={inputId}
          className={labelClassName ?? DEFAULT_LABEL_CLASS}
        >
          {label}
        </label>
      ) : null}

      <input
        id={inputId}
        type={type}
        value={value}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={!label && ariaLabel ? ariaLabel : undefined}
        onChange={(e) => onChange?.(e.target.value)}
        className={[
          // 배경 제거 + 하단 라인 중심 스타일
          "block w-full border-0 border-b border-slate-200 bg-transparent px-0 py-2.5 text-[16px] text-slate-900 placeholder:text-slate-400",
          "focus:border-orange-500 focus:outline-none focus:ring-0",
          "disabled:cursor-not-allowed disabled:text-slate-400",
          inputClassName,
        ]
          .filter(Boolean)
          .join(" ")}
      />
    </div>
  );
}

