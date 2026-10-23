'use client'

import { useActionState } from 'react'
import { login } from '../actions'

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, null)
  return (
    <main className="desk-login">
      <div className="np-logo">
        <small>freewill</small>
        <b>GÜNDEM</b>
      </div>
      <form action={action} className="desk-card">
        <h1>Yazı işleri girişi</h1>
        <label>
          Kullanıcı adı
          <input name="username" autoComplete="username" required autoFocus defaultValue={state?.username} />
        </label>
        <label>
          Şifre
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {state?.error && (
          <p className="desk-error" role="alert">
            {state.error}
          </p>
        )}
        <button className="btn btn-red" disabled={pending}>
          {pending ? 'Giriş yapılıyor…' : 'Giriş yap'}
        </button>
      </form>
    </main>
  )
}
