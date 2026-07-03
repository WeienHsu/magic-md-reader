import { useState } from 'react'

const FEEDBACK_EMAIL = 'powdery-4.beds@icloud.com'
const REPO_URL = 'https://github.com/WeienHsu/magic-md-reader'

const MAILTO_HREF = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(
  'Magic MD Reader 意見回饋'
)}&body=${encodeURIComponent('（請描述你的建議或遇到的問題）\n\n---\n瀏覽器：\n作業系統：\n')}`

export function Feedback() {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const copyEmail = () => {
    navigator.clipboard.writeText(FEEDBACK_EMAIL).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="feedback-wrap">
      <button
        className={`btn ghost ${open ? 'active' : ''}`}
        onClick={() => setOpen((o) => !o)}
        title="意見回饋"
      >
        💌 回饋
      </button>
      {open && (
        <>
          <div className="feedback-backdrop" onClick={() => setOpen(false)} />
          <div className="feedback-popover">
            <h3>意見回饋</h3>
            <p>有建議或發現問題嗎？歡迎來信告訴我。</p>
            <a className="btn primary feedback-mail" href={MAILTO_HREF}>
              ✉️ 寄信回饋
            </a>
            {/* mailto 在未設定郵件程式的環境會沒反應，保留信箱明碼＋複製作為退路 */}
            <div className="feedback-email">
              <code>{FEEDBACK_EMAIL}</code>
              <button className="btn small" onClick={copyEmail}>
                {copied ? '✓ 已複製' : '複製'}
              </button>
            </div>
            <p className="feedback-repo">
              也可以到{' '}
              <a href={`${REPO_URL}/issues`} target="_blank" rel="noreferrer">
                GitHub 回報問題
              </a>{' '}
              或瀏覽{' '}
              <a href={REPO_URL} target="_blank" rel="noreferrer">
                原始碼
              </a>
              。
            </p>
          </div>
        </>
      )}
    </div>
  )
}
