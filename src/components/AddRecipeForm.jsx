import { useState } from 'react'

function AddRecipeForm({ onCreated, onCancel }) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')

  const submit = (event) => {
    event.preventDefault()
    if (!title.trim()) return
    onCreated?.({ title: title.trim(), description: description.trim() || null })
  }

  return (
    <form className="recipe-form" onSubmit={submit}>
      <p className="section-kicker">Nouvelle recette</p>
      <h3>Ajouter une recette familiale</h3>
      <label className="form-field form-field-wide">Titre *<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex. Blanquette de Mamie" required /></label>
      <label className="form-field form-field-wide">Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Quelques mots sur cette recette…" rows="4" /></label>
      <div className="form-actions"><button type="button" className="secondary-button" onClick={onCancel}>Annuler</button><button type="submit" className="primary-button">Continuer</button></div>
    </form>
  )
}

export default AddRecipeForm
