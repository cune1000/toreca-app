const GEMINI_API_KEY = 'AIzaSyDzpEh-QbeF06SFkfpPnDUokRxH8BxozyM'

async function checkGeminiModels() {
    try {
        // 利用可能なモデル一覧を取得
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
        )

        const data = await response.json()

        if (data.error) {
            console.error('Error:', data.error)
            return
        }

        console.log('='.repeat(80))
        console.log('利用可能なGeminiモデル一覧')
        console.log('='.repeat(80))

        const models = data.models || []

        for (const model of models) {
            const name = model.name.replace('models/', '')
            const supportsGenerateContent = model.supportedGenerationMethods?.includes('generateContent')
            const supportsVision = model.inputTokenLimit > 0

            console.log(`\n📦 ${name}`)
            console.log(`   generateContent: ${supportsGenerateContent ? '✅' : '❌'}`)
            console.log(`   Vision対応: ${supportsVision ? '✅' : '❌'}`)
            console.log(`   説明: ${model.description || 'N/A'}`)
        }

        console.log('\n' + '='.repeat(80))
        console.log('推奨モデル（Vision + generateContent対応）')
        console.log('='.repeat(80))

        const recommendedModels = models.filter(m =>
            m.supportedGenerationMethods?.includes('generateContent') &&
            m.inputTokenLimit > 0
        )

        for (const model of recommendedModels) {
            const name = model.name.replace('models/', '')
            if (name.includes('pro') || name.includes('flash')) {
                console.log(`✅ ${name}`)
            }
        }

    } catch (error) {
        console.error('Fetch error:', error)
    }
}

checkGeminiModels()
