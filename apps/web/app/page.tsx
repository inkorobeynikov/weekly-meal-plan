import { redirect } from 'next/navigation'

export default function HomePage(): React.JSX.Element {
  // TODO: check Telegram initData / JWT and route accordingly
  redirect('/plan')
}
