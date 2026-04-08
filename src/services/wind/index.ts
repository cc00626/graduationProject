import request from '@/services/request'

export async function getWindPoll(lastTime?: string) {
  return request.get('/poll', {
    params: lastTime ? { lastTime } : {},
    timeout: 40000,
  })
}

export async function getWeatherNow(
  city: string,
  extensions: 'base' | 'all' = 'base',
  output: 'JSON' | 'XML' = 'JSON',
) {
  return request.get('/weather/now', {
    params: { city, extensions, output },
    timeout: 40000,
  })
}
