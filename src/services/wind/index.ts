import request from '@/services/request'

//风速轮询接口
export async function getWindPoll(lastTime?: string) {
  return request.get('/poll', {
    params: lastTime ? { lastTime } : {},
    timeout: 40000,
  })
}
