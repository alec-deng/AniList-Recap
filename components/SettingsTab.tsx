import React from "react"
import { useMutation, gql } from "@apollo/client"
import { useSettings } from "../contexts/SettingsContext"
import { useAniListData } from "../contexts/AniListDataContext"
import { useAuth } from "../hooks/useAuth"
import { CustomSelect } from './CustomSelect'
import { CustomCheckbox } from './CustomCheckbox'
import { CustomToggle } from './CustomToggle'
import { StateMessage } from './StateMessage'
import { Loader2, AlertCircle } from 'lucide-react'
import { getErrorMessage } from '../lib/apolloErrors'
import HelpIcon from '@mui/icons-material/Help';

const UPDATE_PROFILE_COLOR = gql`
  mutation ($profileColor: String) {
    UpdateUser(profileColor: $profileColor) {
      options {
        profileColor
      }
    }
  }
`

const UPDATE_TITLE_LANGUAGE = gql`
  mutation ($titleLanguage: UserTitleLanguage) {
    UpdateUser(titleLanguage: $titleLanguage) {
      options {
        titleLanguage
      }
    }
  }
`

const UPDATE_DISPLAY_ADULT_CONTENT = gql`
  mutation ($displayAdultContent: Boolean) {
    UpdateUser(displayAdultContent: $displayAdultContent) {
      options {
        displayAdultContent
      }
    }
  }
`

const UPDATE_SCORE_FORMAT = gql`
  mutation ($scoreFormat: ScoreFormat) {
    UpdateUser(scoreFormat: $scoreFormat) {
      mediaListOptions {
        scoreFormat
      }
    }
  }
`

const UPDATE_ROW_ORDER = gql`
  mutation ($rowOrder: String) {
    UpdateUser(rowOrder: $rowOrder) {
      mediaListOptions {
        rowOrder
      }
    }
  }
`

const colorOptions = [
  { name: 'blue', color: '#3db4f2' },
  { name: 'purple', color: '#b368e6' },
  { name: 'green', color: '#4abd4e' },
  { name: 'orange', color: '#ef881a' },
  { name: 'red', color: '#e13333' },
  { name: 'pink', color: '#e85fb2' },
  { name: 'gray', color: '#677b94' },
]

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-medium mb-2 text-gray">{title}</h3>
    {children}
  </div>
)

const HelpTooltip: React.FC<{ text: string }> = ({ text }) => (
  <div className="relative group">
    <HelpIcon className="text-gray cursor-help" sx={{ fontSize: '1rem' }}/>
    <div className="absolute bottom-full shadow-lg border border-white left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1.5 bg-white-100 text-gray text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none w-56 z-10">
      {text}
    </div>
  </div>
)

const checkboxClass = "space-x-1 text-sm text-gray"

export const SettingsTab: React.FC = () => {
  const { 
    profileColor,
    titleLanguage,
    displayAdultContent,
    scoreFormat,
    rowOrder,
    manualCompletion,
    separateEntries,
    tabVisibility,
    showAnimeStats,
    showMangaStats,
    gridColumns,
    gridColumnsSetting,
    setProfileColor,
    setTitleLanguage,
    setDisplayAdultContent,
    setScoreFormat,
    setRowOrder,
    setManualCompletion,
    setSeparateEntries,
    setTabVisibility,
    setShowAnimeStats,
    setShowMangaStats,
    setGridColumns,
    loading,
    error
  } = useSettings()

  const {
    markAnimeDirty,
    markStatsDirty,
    markMangaDirty,
    markMangaStatsDirty,
    markAllRescaled
  } = useAniListData()

  const { logout } = useAuth()

  const [updateProfileColor] = useMutation(UPDATE_PROFILE_COLOR)
  const [updateTitleLanguage] = useMutation(UPDATE_TITLE_LANGUAGE)
  const [updateDisplayAdultContent] = useMutation(UPDATE_DISPLAY_ADULT_CONTENT)
  const [updateScoreFormat] = useMutation(UPDATE_SCORE_FORMAT)
  const [updateRowOrder] = useMutation(UPDATE_ROW_ORDER)

  const handleColorChange = async (color: string) => {
    setProfileColor(color)
    try {
      await updateProfileColor({ variables: { profileColor: color } })
    } catch (error) {
      console.error('Failed to update profile color:', error)
    }
  }

  const handleLanguageChange = async (language: string) => {
    setTitleLanguage(language)
    try {
      await updateTitleLanguage({ variables: { titleLanguage: language } })
    } catch (error) {
      console.error('Failed to update title language:', error)
    }
  }

  const handleAdultContentChange = async (checked: boolean) => {
    setDisplayAdultContent(checked)
    try {
      await updateDisplayAdultContent({ variables: { displayAdultContent: checked } })
      // Marks nothing dirty: this governs browse/search, not your own list —
      // every consumer already filters client-side
    } catch (error) {
      console.error('Failed to update adult content setting:', error)
    }
  }

  const handleScoreFormatChange = async (format: string) => {
    setScoreFormat(format)
    try {
      await updateScoreFormat({ variables: { scoreFormat: format } })

      // Unlike adult content, this genuinely invalidates: scores come back rescaled.
      // Flagged as a rescale too — until the refetch lands the cached scores aren't
      // slightly stale, they're on the wrong scale, so each tab waits rather than
      // showing an 8 under POINT_100.
      markAnimeDirty()
      markStatsDirty()
      markMangaDirty()
      markMangaStatsDirty()
      markAllRescaled()
    } catch (error) {
      console.error('Failed to update score format:', error)
    }
  }

  const handleRowOrderChange = async (order: string) => {
    setRowOrder(order)
    try {
      await updateRowOrder({ variables: { rowOrder: order } })
    } catch (error) {
      console.error('Failed to update row order:', error)
    }
  }

  const handleManualCompletionChange = async (manual: boolean) => {
    setManualCompletion(manual)
  }

  const handleSeparateEntriesChange = async (separate: boolean) => {
    setSeparateEntries(separate)
  }

  const handleTabVisibilityChange = async (visibility: string) => {
    setTabVisibility(visibility as 'both' | 'anime' | 'manga')
  }

  // Resizes the popup itself — Chrome sizes it to the document
  const handleGridColumnsChange = async (columns: string) => {
    setGridColumns(columns === '4' ? 4 : 3)
  }

  if (error)
    return (
      <StateMessage
        icon={AlertCircle}
        tone="error"
        message={getErrorMessage(error, "Error loading settings.")}
      />
    )
  if (loading) return <StateMessage icon={Loader2} spin message="Loading settings..." />

  return (
    // Margin, not stretch — the same controls either way
    <div className={`py-4 space-y-5 flex-1 ${gridColumns === 4 ? "px-24" : "px-4"}`}>
      <Section title="Profile Color">
        <div className="grid grid-cols-7 gap-2 ml-2">
          {colorOptions.map((option) => (
            <button
              key={option.name}
              onClick={() => handleColorChange(option.name)}
              className={`
                w-8 h-8 rounded-lg border-2 transition-all duration-200 hover:scale-110
                ${profileColor === option.color 
                  ? 'border-white-100 shadow-lg scale-105' 
                  : 'border-white-100/50'
                }
              `}
              style={{ backgroundColor: option.color }}
            >
              {profileColor === option.color && (
                <div className="w-1.5 h-1.5 bg-white-100 rounded-full mx-auto"></div>
              )}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Scoring System">
        <CustomSelect
          options={[
            { name: "100 Point (55/100)", value: "POINT_100" },
            { name: "10 Point Decimal (5.5/10)", value: "POINT_10_DECIMAL" },
            { name: "10 Point (5/10)", value: "POINT_10" },
            { name: "5 Star (3/5)", value: "POINT_5" },
            { name: "3 Point Smiley :)", value: "POINT_3" }
          ]}
          value={scoreFormat}
          onChange={handleScoreFormatChange}
          profileColor={profileColor}
          className="w-full"
        />
      </Section>

      <Section title="Default List Order">
        <CustomSelect
          options={[
            { name: "Score", value: "score" },
            { name: "Title", value: "title" },
            { name: "Last Updated", value: "updatedAt" },
            { name: "Last Added", value: "id" }
          ]}
          value={rowOrder}
          onChange={handleRowOrderChange}
          profileColor={profileColor}
          className="w-full"
        />
      </Section>

      <Section title="Title Language">
        <CustomSelect
          options={[
            { name: "Romaji (Sousou no Frieren)", value: "ROMAJI" },
            { name: "English (Frieren: Beyond Journey's End)", value: "ENGLISH" },
            { name: "Native (葬送のフリーレン)", value: "NATIVE" }
          ]}
          value={titleLanguage}
          onChange={handleLanguageChange}
          profileColor={profileColor}
          className="w-full"
        />
      </Section>

      <Section title="Grid Layout">
        <CustomSelect
          options={[
            { value: "3", name: "3 Cards (Compact)" },
            { value: "4", name: "4 Cards (Wide)" }
          ]}
          value={String(gridColumnsSetting)}
          onChange={handleGridColumnsChange}
          profileColor={profileColor}
          className="w-full"
        />
        {/* The popup window can't narrow itself, so a compact choice waits */}
        {gridColumnsSetting !== gridColumns && (
          <p className="text-xs text-gray/60 mt-2">
            Applies the next time you open the popup.
          </p>
        )}
      </Section>

      {/* Kept above Show in Stats: changing it resets both stats toggles */}
      <Section title="Media Type">
        <CustomToggle
          options={[
            { label: "Both", value: "both" },
            { label: "Anime", value: "anime" },
            { label: "Manga", value: "manga" }
          ]}
          value={tabVisibility}
          onChange={handleTabVisibilityChange}
          profileColor={profileColor}
          className="w-full"
        />
      </Section>

      <Section title="Show in Stats">
        <div className="flex items-center gap-6">
          <CustomCheckbox
            checked={showAnimeStats}
            onChange={setShowAnimeStats}
            label="Anime"
            profileColor={profileColor}
            className={checkboxClass}
          />
          <CustomCheckbox
            checked={showMangaStats}
            onChange={setShowMangaStats}
            label="Manga"
            profileColor={profileColor}
            className={checkboxClass}
          />
        </div>
      </Section>

      <Section title="Preferences">
        <div className="space-y-3">
          <div className="flex items-center space-x-2">
            <CustomCheckbox
              checked={manualCompletion}
              onChange={handleManualCompletionChange}
              label="Manually Mark As Completed"
              profileColor={profileColor}
              className={checkboxClass}
            />
            <HelpTooltip text="When enabled, anime/manga stay in your list even after completing all episodes/chapters. A one-click complete button will appear to manually mark them as completed." />
          </div>

          <div className="flex items-center space-x-2">
            <CustomCheckbox
              checked={separateEntries}
              onChange={handleSeparateEntriesChange}
              label="Separate Caught-Up Entries"
              profileColor={profileColor}
              className={checkboxClass}
            />
            <HelpTooltip text="When enabled, anime/manga that you've caught up to (watched/read all available episodes/chapters) are shown separately from those with remaining content." />
          </div>

          <div>
            <CustomCheckbox
              checked={displayAdultContent}
              onChange={handleAdultContentChange}
              label="Display 18+ Content"
              profileColor={profileColor}
              className={checkboxClass}
            />
          </div>
        </div>
      </Section>

      <div className="pt-1 flex items-center justify-between">
        <button
          onClick={logout}
          className="w-16 h-8 text-white-100 rounded-lg text-sm font-medium"
          style={{ backgroundColor: profileColor }}
        >
          Logout
        </button>
      </div>
    </div>
  )
}