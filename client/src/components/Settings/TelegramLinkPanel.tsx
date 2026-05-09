import { useState, useEffect } from 'react';
import { Send, CheckCircle, Copy, ExternalLink, XCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export function TelegramLinkPanel() {
  const { user } = useAuth();
  const [verificationCode, setVerificationCode] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Generate a random 6-digit code for demo (would come from server in production)
  const generateCode = () => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setVerificationCode(code);
  };

  const copyCode = () => {
    if (verificationCode) {
      navigator.clipboard.writeText(verificationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isLinked = user?.telegram_username;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-aura-border">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
          <Send className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold">Telegram</h3>
          <p className="text-xs text-aura-text-dim">Привязка аккаунта</p>
        </div>
      </div>

      {isLinked ? (
        /* Already linked */
        <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/30">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-green-400">Аккаунт привязан</div>
              <div className="text-xs text-aura-text-muted mt-1">
                @{user.telegram_username}
              </div>
            </div>
          </div>
          <button className="mt-3 w-full px-3 py-2 text-xs font-medium rounded-lg bg-aura-surface2 hover:bg-aura-surface3 border border-aura-border transition-colors">
            Отвязать Telegram
          </button>
        </div>
      ) : (
        /* Not linked */
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-aura-surface2 border border-aura-border">
            <p className="text-sm text-aura-text-dim leading-relaxed">
              Привяжи свой Telegram для дополнительной безопасности и уведомлений.
            </p>
          </div>

          {!verificationCode ? (
            <button
              onClick={generateCode}
              className="w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Получить код верификации
            </button>
          ) : (
            <div className="space-y-3">
              {/* Code display */}
              <div className="p-4 rounded-xl bg-aura-surface2 border-2 border-dashed border-aura-primary/50">
                <div className="text-xs text-aura-text-dim mb-2">Твой код верификации:</div>
                <div className="flex items-center justify-between">
                  <div className="text-3xl font-mono font-bold text-aura-primary tracking-wider">
                    {verificationCode}
                  </div>
                  <button
                    onClick={copyCode}
                    className="p-2 rounded-lg bg-aura-surface3 hover:bg-aura-elevated transition-colors"
                    title="Скопировать"
                  >
                    {copied ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <Copy className="w-5 h-5 text-aura-text-dim" />
                    )}
                  </button>
                </div>
              </div>

              {/* Instructions */}
              <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/30">
                <div className="text-sm font-medium text-blue-400 mb-2">Инструкция:</div>
                <ol className="text-xs text-aura-text-dim space-y-1 list-decimal list-inside">
                  <li>Открой Telegram и найди бота <span className="font-mono text-aura-text">@AuraVerifyBot</span></li>
                  <li>Отправь команду <span className="font-mono text-aura-text">/start</span></li>
                  <li>Введи код: <span className="font-mono text-aura-text">{verificationCode}</span></li>
                  <li>Аккаунт будет привязан автоматически</li>
                </ol>
              </div>

              {/* Open in Telegram */}
              <a
                href={`https://t.me/AuraVerifyBot?start=${verificationCode}`}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full px-4 py-3 rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-medium transition-colors flex items-center justify-center gap-2"
              >
                <ExternalLink className="w-4 h-4" />
                Открыть в Telegram
              </a>

              {/* Cancel */}
              <button
                onClick={() => setVerificationCode(null)}
                className="w-full px-4 py-2 text-sm text-aura-text-dim hover:text-aura-text transition-colors"
              >
                Отмена
              </button>
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="p-3 rounded-xl bg-aura-surface2 border border-aura-border text-xs text-aura-text-muted leading-relaxed">
        <span className="font-semibold text-aura-text">Зачем это нужно?</span><br />
        Привязка Telegram позволяет получать уведомления о важных событиях и восстановить доступ к аккаунту.
      </div>
    </div>
  );
}
