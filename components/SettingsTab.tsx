import React from "react"
import { useMutation, gql } from "@apollo/client"
import { useSettings } from "../contexts/SettingsContext"
import { useAuth } from "../hooks/useAuth"
import { CustomSelect } from './CustomSelect'
import { CustomCheckbox } from './CustomCheckbox'
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

export const SettingsTab: React.FC = () => {
  const { 
    profileColor,
    titleLanguage,
    displayAdultContent,
    scoreFormat,
    rowOrder,
    manualCompletion,
    separateEntries,
    setProfileColor,
    setTitleLanguage,
    setDisplayAdultContent,
    setScoreFormat,
    setRowOrder,
    setManualCompletion,
    setSeparateEntries,
    loading
  } = useSettings()

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
    } catch (error) {
      console.error('Failed to update adult content setting:', error)
    }
  }

  const handleScoreFormatChange = async (format: string) => {
    setScoreFormat(format)
    try {
      await updateScoreFormat({ variables: { scoreFormat: format } })
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

  if (loading) return <div className="p-4">Loading...</div>

  return (
    <div className="p-4 space-y-5">
      {/* Profile Color */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-gray">Profile Color</h3>
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
      </div>

      {/* Score Format */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-gray">Scoring System</h3>
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
      </div>

      {/* Row Order */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-gray">Default List Order</h3>
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
      </div>

      {/* Title Language */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-gray">Title Language</h3>
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
      </div>

      {/* Manual Completion */}
      <div className="flex items-center space-x-2">
        <CustomCheckbox
          checked={manualCompletion}
          onChange={handleManualCompletionChange}
          label="Manually Mark As Completed"
          profileColor={profileColor}
          className="space-x-1 text-sm text-gray"
        />
        <div className="relative group">
          <HelpIcon className="text-gray cursor-help" sx={{ fontSize: '1rem' }}/>
          <div className="absolute bottom-full shadow-lg border border-white left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1.5 bg-white-100 text-gray text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none w-56 z-10">
            When enabled, anime stay in your watching list even after completing all episodes. A one-click complete button will appear to manually mark them as completed.
          </div>
        </div>
      </div>

      {/* Separate Entries */}
      <div className="flex items-center space-x-2">
        <CustomCheckbox
          checked={separateEntries}
          onChange={handleSeparateEntriesChange}
          label="Separate Caught-Up Entries"
          profileColor={profileColor}
          className="space-x-1 text-sm text-gray"
        />
        <div className="relative group">
          <HelpIcon className="text-gray cursor-help" sx={{ fontSize: '1rem' }}/>
          <div className="absolute bottom-full shadow-lg border border-white left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1.5 bg-white-100 text-gray text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none w-56 z-10">
            When enabled, anime that you've caught up to (watched all available episodes) are shown separately from anime with remaining episodes to watch.
          </div>
        </div>
      </div>

      {/* Adult Content */}
      <div>
        <CustomCheckbox
          checked={displayAdultContent}
          onChange={handleAdultContentChange}
          label="Display 18+ Content"
          profileColor={profileColor}
          className="space-x-1 text-sm text-gray"
        />
      </div>

      {/* Logout */}
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