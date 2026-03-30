"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import styles from "./auth.module.css";
import { ClubPasswordField } from "./club-password-field";

export function LoginForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const adminPasswordHiddenRef = useRef<HTMLInputElement>(null);
  const [nickname, setNickname] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [modalError, setModalError] = useState("");

  const isAdminNickname = useMemo(
    () => nickname.trim().toLowerCase() === "admin",
    [nickname],
  );

  useEffect(() => {
    if (!showAdminModal) {
      return;
    }

    const previous = document.body.dataset.disableGlobalNavLoading;
    document.body.dataset.disableGlobalNavLoading = "true";

    return () => {
      if (previous === undefined) {
        delete document.body.dataset.disableGlobalNavLoading;
      } else {
        document.body.dataset.disableGlobalNavLoading = previous;
      }
    };
  }, [showAdminModal]);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isAdminNickname) {
      if (adminPasswordHiddenRef.current) {
        adminPasswordHiddenRef.current.value = "";
      }
      return;
    }

    event.preventDefault();
    setModalError("");
    setAdminPassword("");
    setShowAdminModal(true);
  }

  function closeModal() {
    setShowAdminModal(false);
    setModalError("");
    setAdminPassword("");
  }

  function submitWithAdminPassword() {
    if (!adminPassword.trim()) {
      setModalError("パスワードを入力してください");
      return;
    }

    if (adminPasswordHiddenRef.current) {
      adminPasswordHiddenRef.current.value = adminPassword;
    }
    setShowAdminModal(false);

    const form = formRef.current;
    if (form) {
      form.submit();
    }
  }

  return (
    <>
      <form
        ref={formRef}
        action="/api/auth/login"
        method="post"
        className={styles.form}
        onSubmit={onSubmit}
        data-disable-global-nav-loading="true"
      >
        <input type="hidden" name="redirectTo" value="/auth" />
        <input ref={adminPasswordHiddenRef} type="hidden" name="adminPassword" defaultValue="" />
        <label>
          ニックネーム
          <input
            name="nickname"
            type="text"
            placeholder="例: yuta_8"
            required
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
          />
        </label>
        <label>
          部活パスワード
          <ClubPasswordField />
        </label>
        <button type="submit">ログインする</button>
      </form>

      {showAdminModal ? (
        <div className={styles.modalOverlay} role="presentation">
          <section className={styles.modalCard} role="dialog" aria-modal="true" aria-labelledby="admin-password-title">
            <h3 id="admin-password-title">admin ログイン確認</h3>
            <p className={styles.meta}>admin でログインするにはパスワードを入力してください。</p>
            <label className={styles.modalLabel}>
              パスワード
              <input
                type="password"
                value={adminPassword}
                onChange={(event) => setAdminPassword(event.target.value)}
                autoFocus
              />
            </label>
            {modalError ? <p className={styles.error}>{modalError}</p> : null}
            <div className={styles.modalActions}>
              <button type="button" className={styles.secondaryButton} onClick={closeModal}>キャンセル</button>
              <button type="button" className={styles.primaryButton} onClick={submitWithAdminPassword}>送信</button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
