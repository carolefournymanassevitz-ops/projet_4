/**
 * Copie un texte dans le presse-papiers. Renvoie true si la copie a réussi.
 *
 * navigator.clipboard n'existe que dans un « contexte sécurisé » (https ou
 * localhost). Si le front est ouvert via l'adresse réseau de Vite
 * (http://192.168.x.x:5173), l'API est absente et la copie échoue — d'où le
 * repli sur execCommand, et un booléen de retour plutôt qu'une exception :
 * l'appelant doit toujours pouvoir prévenir l'utilisateur.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Permission refusée ou document non focalisé : on tente le repli.
    }
  }
  return copyWithFallback(text);
}

/** Repli historique : sélectionner un champ caché puis déclencher la copie. */
function copyWithFallback(text: string): boolean {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  // Hors écran : évite que la page ne saute au moment de la sélection.
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(textarea);
  }
}
