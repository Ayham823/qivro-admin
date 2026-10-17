"use client"

import Link from "next/link"
import { useBuildingReview } from "./useBuildingReview"
import styles from "./building-review.module.css"

export default function BuildingLinkReview({ listingId }: { listingId: string }) {
  const review = useBuildingReview(listingId)
  const { data } = review
  const selected = review.buildings.find((item) => item.id === review.buildingId)
  const locked = review.loading || review.busy || review.stale
  const validNote = review.note.trim().length >= 10 && review.note.length <= 1000
  return <section className={styles.page} aria-label="Building link review">
    <Link href="/listings">Back to listings</Link>
    <header><h1>Building link review</h1><p>{data?.listing.title ?? listingId}</p>
      {data && <p>{data.listing.city} · {data.listing.status} · {data.listing.availabilityStatus}</p>}
    </header>
    {review.loading && <p role="status">Loading latest review...</p>}
    {review.error && <p role="alert">{review.error}</p>}
    {review.message && <p role="status">{review.message}</p>}
    <button className="ops-button" type="button" disabled={review.loading || review.busy} onClick={() => void review.reload()}>Reload latest review</button>
    {data && <>
      <p>Version {data.link?.version ?? 0} · {data.link ? (data.link.published ? "Publication approved" : "Private association") : "No building linked"}</p>
      <p>Verify the building from authorized evidence. Approximate map pins and OSM boundaries do not establish ownership.</p>
      <form className={styles.form} onSubmit={(event) => { event.preventDefault(); void review.mutate(false) }}>
        <fieldset disabled={locked}>
          <legend>Association and publication</legend>
          <label>Project<select aria-label="Project" className="ops-input" value={review.placeId} onChange={(event) => review.selectProject(event.target.value)} required>
            <option value="">Choose a project</option>{review.projects.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select></label>
          <label>Building<select aria-label="Building" className="ops-input" value={review.buildingId} onChange={(event) => review.selectBuilding(event.target.value)} disabled={review.catalogLoading || !!review.catalogError} required>
            <option value="">Choose a building</option>{review.buildings.map((building) => <option key={building.id} value={building.id}>{building.properties.name}</option>)}
          </select></label>
          {review.catalogLoading && <p role="status">Loading building sources...</p>}
          {review.catalogError && <p role="alert">{review.catalogError} <button type="button" className="ops-button" onClick={review.retryCatalog}>Retry building sources</button></p>}
          {!review.catalogLoading && !review.catalogError && !review.buildings.length && <p>No building coverage is available for this project.</p>}
          {data.link && !review.catalogLoading && !selected && <p>The previous building is not in the current source. Select a supported building or withdraw publication.</p>}
          {selected && <div className={styles.source}>
            <p>{[selected.properties.street, selected.properties.houseNumber].filter(Boolean).join(", ") || "Address not verified"}</p>
            <a href={selected.properties.sourceUrl} target="_blank" rel="noreferrer">Review building source</a>
            <p>OSM version {selected.properties.sourceVersion} · Updated {selected.properties.sourceModifiedAt.slice(0, 10)}</p>
          </div>}
          <label>Evidence reference / review note<textarea className="ops-input" value={review.note} minLength={10} maxLength={1000} rows={4} required onChange={(event) => review.setNote(event.target.value)} aria-describedby="review-note-help" /></label>
          <p id="review-note-help">10–1000 characters. Use an authorized record reference, not personal documents or secrets. Notes stay private.</p>
          <label className={styles.check}><input type="checkbox" checked={review.verified} onChange={(event) => review.setVerified(event.target.checked)} />I verified this building association against authorized evidence.</label>
          <label className={styles.check}><input type="checkbox" checked={review.published} onChange={(event) => review.setPublished(event.target.checked)} />Publish the exact building association</label>
          {review.published && <label className={styles.check}><input type="checkbox" checked={review.consent} onChange={(event) => review.setConsent(event.target.checked)} />I confirmed permission from the appropriate owner to disclose this exact building.</label>}
          <p>Public results also require an available, published listing, the same owner, and the reviewed source version.</p>
          <div className={styles.actions}>
            <button className="ops-button ops-button-primary" type="submit" disabled={!selected || !validNote || !review.verified || (review.published && !review.consent) || review.catalogLoading}>Save review</button>
            <button className="ops-button" type="button" disabled={!data.link?.published || !validNote} onClick={() => void review.mutate(true)}>Withdraw publication</button>
          </div>
        </fieldset>
      </form>
      <section aria-labelledby="review-history-title"><h2 id="review-history-title">Review history</h2><p>Newest {data.historyLimit} reviews</p>
        {data.reviews.length ? <ol className={styles.history}>{data.reviews.map((item) => <li key={item.version}>
          <strong>Version {item.version} · {item.action} · {item.published ? "Publication approved" : "Private"}</strong>
          <p>{item.placeId} / {item.buildingId} · OSM version {item.sourceVersion}</p>
          <p>{item.note}</p><time dateTime={item.createdAt}>{item.createdAt.slice(0, 19).replace("T", " ")} UTC</time>
        </li>)}</ol> : <p>No reviews yet.</p>}
      </section>
    </>}
  </section>
}
