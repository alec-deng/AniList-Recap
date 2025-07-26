import React from "react"
import { useMutation, gql } from "@apollo/client"
import { useSettings } from "../contexts/SettingsContext"
import { useAuth } from "../hooks/useAuth"

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
        <div className="grid grid-cols-7 gap-2">
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

      {/* Title Language */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-gray">Title Language</h3>
        <select 
          value={titleLanguage}
          onChange={(e) => handleLanguageChange(e.target.value)}
          className="w-full p-2 border border-gray/30 rounded-lg bg-white-100 text-gray focus:outline-none focus:border-blue"
        >
          <option value="ROMAJI">Romaji (Sousou no Frieren)</option>
          <option value="ENGLISH">English (Frieren: Beyond Journey’s End)</option>
          <option value="NATIVE">Native (葬送のフリーレン)</option>
        </select>
      </div>

      {/* Score Format */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-gray">Scoring System</h3>
        <select 
          value={scoreFormat}
          onChange={(e) => handleScoreFormatChange(e.target.value)}
          className="w-full p-2 border border-gray/30 rounded-lg bg-white-100 text-gray focus:outline-none focus:border-blue"
        >
          <option value="POINT_100">100 Point (55/100)</option>
          <option value="POINT_10_DECIMAL">10 Point Decimal (5.5/10)</option>
          <option value="POINT_10">10 Point (5/10)</option>
          <option value="POINT_5">5 Star (3/5)</option>
          <option value="POINT_3">3 Point Smiley :)</option>
        </select>
      </div>

      {/* Row Order */}
      <div>
        <h3 className="text-sm font-medium mb-2 text-gray">Default List Order</h3>
        <select 
          value={rowOrder}
          onChange={(e) => handleRowOrderChange(e.target.value)}
          className="w-full p-2 border border-gray/30 rounded-lg bg-white-100 text-gray focus:outline-none focus:border-blue"
        >
          <option value="score">Score</option>
          <option value="title">Title</option>
          <option value="updatedAt">Last Updated</option>
          <option value="id">Last Added</option>
        </select>
      </div>

      {/* Manual Completion */}
      <div>
        <label className="flex items-center pl-1 space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={manualCompletion}
            onChange={(e) => handleManualCompletionChange(e.target.checked)}
            className="w-4 h-4 text-blue border-gray/30 rounded focus:ring-blue focus:ring-2"
          />
          <span className="text-sm text-gray">Manually Mark As Completed</span>
        </label>
      </div>

      {/* Separate Entries */}
      <div>
        <label className="flex items-center pl-1 space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={separateEntries}
            onChange={(e) => handleSeparateEntriesChange(e.target.checked)}
            className="w-4 h-4 text-blue border-gray/30 rounded focus:ring-blue focus:ring-2"
          />
          <span className="text-sm text-gray">Separate Caught-Up Entries</span>
        </label>
      </div>

      {/* Adult Content */}
      <div>
        <label className="flex items-center pl-1 space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={displayAdultContent}
            onChange={(e) => handleAdultContentChange(e.target.checked)}
            className="w-4 h-4 text-blue border-gray/30 rounded focus:ring-blue focus:ring-2"
          />
          <span className="text-sm text-gray">18+ Content</span>
        </label>
      </div>

      {/* Logout */}
      <div className="pt-1 flex items-center justify-between">
        <button
          onClick={logout}
          className="w-16 h-8 bg-blue text-white-100 rounded-lg text-sm font-medium hover:bg-[#36a3dd] duration-200"
        >
          Logout
        </button>
      </div>
    </div>
  )
}