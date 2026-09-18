// Builds a hidden form and submits it, navigating the browser to PayFast's
// hosted payment page. Client-side counterpart to lib/payfast.ts (which uses
// Node's crypto module and can only run on the server).
export function redirectToPayfast(action: string, fields: Record<string, string>) {
  const form = document.createElement("form")
  form.method = "POST"
  form.action = action
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input")
    input.type = "hidden"
    input.name = name
    input.value = value
    form.appendChild(input)
  }
  document.body.appendChild(form)
  form.submit()
}
