"use client";

import { useState } from "react";
import styles from "./auth.module.css";

type ClubPasswordFieldProps = {
  name?: string;
  placeholder?: string;
  required?: boolean;
};

export function ClubPasswordField({
  name = "clubPassword",
  placeholder = "部活共通パスワード",
  required = true,
}: ClubPasswordFieldProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className={styles.passwordFieldRow}>
      <input
        name={name}
        type={isVisible ? "text" : "password"}
        placeholder={placeholder}
        required={required}
      />
      <button
        type="button"
        className={styles.togglePasswordButton}
        onClick={() => setIsVisible((previous) => !previous)}
        aria-label={isVisible ? "パスワードを隠す" : "パスワードを表示する"}
      >
        {isVisible ? "非表示" : "表示"}
      </button>
    </div>
  );
}