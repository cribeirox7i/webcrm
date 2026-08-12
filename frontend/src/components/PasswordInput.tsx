import { useState } from "react";
import { EyeIcon, EyeOffIcon } from "./icons";

interface PasswordInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  autoFocus?: boolean;
}

/** Campo de senha com botão de olho pra mostrar/esconder o texto digitado -- usado em
 * todo formulário de senha do app (login, trocar senha, definir senha via convite,
 * definir senha pelo admin). */
export function PasswordInput({ id, value, onChange, placeholder, required, autoFocus }: PasswordInputProps) {
  const [visivel, setVisivel] = useState(false);

  return (
    <div className="password-input">
      <input
        id={id}
        type={visivel ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoFocus={autoFocus}
      />
      <button
        type="button"
        className="password-input-toggle"
        onClick={() => setVisivel((v) => !v)}
        aria-label={visivel ? "Esconder senha" : "Mostrar senha"}
        title={visivel ? "Esconder senha" : "Mostrar senha"}
      >
        {visivel ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
